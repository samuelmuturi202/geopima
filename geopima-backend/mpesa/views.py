import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views.generic import ListView, DetailView, View
from django.shortcuts import get_object_or_404, redirect
from django.contrib import messages

from .models import MpesaTransaction, PaymentSettlement
from .services import MpesaSettlementEngine


@method_decorator(csrf_exempt, name='dispatch')
class MpesaValidationView(View):
    """
    Safaricom Validation Endpoint.
    Validates incoming C2B payments before Safaricom accepts money from the user.
    """
    def post(self, request, *args, **kwargs):
        try:
            payload = json.loads(request.body.decode('utf-8'))
            # Optional custom validation rules (e.g. check account number)
            return JsonResponse({"ResultCode": "0", "ResultDesc": "Accepted"})
        except Exception as e:
            return JsonResponse({"ResultCode": "C2B00016", "ResultDesc": f"Rejected: {str(e)}"})


@method_decorator(csrf_exempt, name='dispatch')
class MpesaConfirmationView(View):
    """
    Safaricom Confirmation Endpoint.
    Receives successful transaction callbacks and triggers automatic invoice settlement.
    """
    def post(self, request, *args, **kwargs):
        try:
            payload = json.loads(request.body.decode('utf-8'))
            MpesaSettlementEngine.process_payment(payload)
            return JsonResponse({"ResultCode": "0", "ResultDesc": "Success"})
        except Exception as e:
            return JsonResponse({"ResultCode": "1", "ResultDesc": str(e)}, status=400)


class MpesaTransactionListView(ListView):
    """
    Dashboard view listing all incoming M-Pesa C2B transactions.
    """
    model = MpesaTransaction
    template_name = 'mpesa/transaction_list.html'
    context_object_name = 'transactions'
    paginate_by = 25
    ordering = ['-created_at']


class MpesaTransactionDetailView(DetailView):
    """
    Detail view for a single M-Pesa transaction and its settlement logs.
    """
    model = MpesaTransaction
    template_name = 'mpesa/transaction_detail.html'
    context_object_name = 'transaction'


class ManualSettlementView(View):
    """
    Manual override trigger to re-run settlement on unmatched/unsettled M-Pesa transactions.
    """
    def post(self, request, pk, *args, **kwargs):
        tx = get_object_or_404(MpesaTransaction, pk=pk)
        if tx.is_settled:
            messages.warning(request, f"Transaction {tx.trans_id} is already settled.")
        else:
            settled = MpesaSettlementEngine.reprocess_unsettled_transaction(tx)
            if settled:
                messages.success(request, f"Successfully settled transaction {tx.trans_id}.")
            else:
                messages.error(request, f"Could not automatically match transaction {tx.trans_id} to a tenant.")
        return redirect('mpesa:transaction_detail', pk=pk)