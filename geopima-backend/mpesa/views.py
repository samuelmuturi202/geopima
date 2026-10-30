import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
from django.shortcuts import get_object_or_404

from .models import MpesaTransaction, PaymentSettlement
from .services import MpesaSettlementEngine


@method_decorator(csrf_exempt, name='dispatch')
class MpesaValidationView(View):
    """
    Safaricom Validation Endpoint.
    """
    def post(self, request, *args, **kwargs):
        try:
            payload = json.loads(request.body.decode('utf-8'))
            return JsonResponse({"ResultCode": "0", "ResultDesc": "Accepted"})
        except Exception as e:
            return JsonResponse({"ResultCode": "C2B00016", "ResultDesc": f"Rejected: {str(e)}"})


@method_decorator(csrf_exempt, name='dispatch')
class MpesaConfirmationView(View):
    """
    Safaricom Confirmation Endpoint.
    """
    def post(self, request, *args, **kwargs):
        try:
            payload = json.loads(request.body.decode('utf-8'))
            MpesaSettlementEngine.process_payment(payload)
            return JsonResponse({"ResultCode": "0", "ResultDesc": "Success"})
        except Exception as e:
            return JsonResponse({"ResultCode": "1", "ResultDesc": str(e)}, status=400)


class MpesaTransactionListAPIView(View):
    """
    JSON API endpoint matching frontend mpesa.js expectations.
    """
    def get(self, request, *args, **kwargs):
        transactions = MpesaTransaction.objects.all().order_by('-created_at')
        data = [tx.to_json_dict() for tx in transactions]
        return JsonResponse({"results": data}, safe=False)


class MpesaBatchVerifyAPIView(View):
    """
    Triggered by 'Confirm Multiple Transactions' button in mpesa.html.
    """
    def post(self, request, *args, **kwargs):
        unsettled = MpesaTransaction.objects.filter(is_settled=False)
        count = 0
        for tx in unsettled:
            if MpesaSettlementEngine.reprocess_unsettled_transaction(tx):
                count += 1
        return JsonResponse({"status": "success", "reprocessed_count": count})


class ManualSettlementAPIView(View):
    """
    API endpoint to manually reprocess a single transaction.
    """
    def post(self, request, pk, *args, **kwargs):
        tx = get_object_or_404(MpesaTransaction, pk=pk)
        if tx.is_settled:
            return JsonResponse({"status": "warning", "message": f"Transaction {tx.trans_id} is already settled."})
        
        settled = MpesaSettlementEngine.reprocess_unsettled_transaction(tx)
        if settled:
            return JsonResponse({"status": "success", "message": f"Successfully settled transaction {tx.trans_id}."})
        else:
            return JsonResponse({"status": "error", "message": f"Could not match transaction {tx.trans_id} to a tenant."}, status=400)


class RentCollectionListAPIView(View):
    """
    JSON API endpoint for rent collection records (finance.js).
    """
    def get(self, request, *args, **kwargs):
        settlements = PaymentSettlement.objects.select_related('transaction', 'tenant', 'invoice', 'tenant__unit', 'tenant__unit__property').all().order_by('-settled_at')
        data = []
        for index, s in enumerate(settlements):
            unit = getattr(s.tenant, 'unit', None)
            prop = getattr(unit, 'property', None) if unit else None
            data.append({
                "id": s.id,
                "receiptNo": s.receipt_number or f"202206{3556+index}",
                "tenantNo": s.tenant.tenant_id,
                "tenant": s.tenant.name,
                "property": prop.name if prop else "--",
                "unit": unit.unit_name if unit else "--",
                "bank": "Lipa Na M-Pesa",
                "refCode": s.transaction.trans_id,
                "type": "mpesa",
                "slipDate": s.settled_at.strftime('%Y-%m-%d'),
                "entryDate": s.settled_at.strftime('%Y-%m-%d'),
                "mode": "auto",
                "amount": float(s.amount_applied),
                "balance": float(s.invoice.balance) if s.invoice else 0.0,
                "phone": s.tenant.phone_number
            })
        return JsonResponse({"results": data}, safe=False)


class RentCollectionDetailAPIView(View):
    """
    JSON API endpoint for single payment receipt detail modal.
    """
    def get(self, request, pk, *args, **kwargs):
        s = get_object_or_404(PaymentSettlement, pk=pk)
        unit = getattr(s.tenant, 'unit', None)
        prop = getattr(unit, 'property', None) if unit else None
        landlord_name = prop.landlord.name if prop and hasattr(prop, 'landlord') and prop.landlord else "SAMMY GACHARI"
        
        data = {
            "id": s.id,
            "receipt_number": s.receipt_number or f"202206{3556+s.id}",
            "tenant_no": s.tenant.tenant_id,
            "tenant": s.tenant.name,
            "landlord": landlord_name,
            "property": prop.name if prop else "sammy gachari",
            "unit": unit.unit_name if unit else "B18",
            "phone": s.tenant.phone_number,
            "amount": float(s.amount_applied),
            "balance": float(s.invoice.balance) if s.invoice else 0.0,
            "bank": "Lipa Na M-Pesa",
            "ref_no": s.transaction.trans_id,
            "slip_date": s.settled_at.strftime('%Y-%m-%d')
        }
        return JsonResponse(data)