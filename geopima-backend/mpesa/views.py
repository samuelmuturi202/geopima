import json
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from config_core.permissions import RolePermission
from .models import MpesaTransaction, PaymentSettlement
from .services import MpesaSettlementEngine


class MpesaValidationView(APIView):
    """
    Safaricom Validation Endpoint.
    """
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def post(self, request):
        try:
            payload = json.loads(request.body.decode('utf-8'))
            return Response({"ResultCode": "0", "ResultDesc": "Accepted"})
        except Exception as e:
            return Response({"ResultCode": "C2B00016", "ResultDesc": f"Rejected: {str(e)}"})


class MpesaConfirmationView(APIView):
    """
    Safaricom Confirmation Endpoint.
    """
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def post(self, request):
        try:
            payload = json.loads(request.body.decode('utf-8'))
            MpesaSettlementEngine.process_payment(payload)
            return Response({"ResultCode": "0", "ResultDesc": "Success"})
        except Exception as e:
            return Response({"ResultCode": "1", "ResultDesc": str(e)}, status=400)


class MpesaTransactionListAPIView(APIView):
    """
    JSON API endpoint matching frontend mpesa.js expectations.
    """
    permission_classes = (RolePermission,)
    role_permission_module = 'payment'

    def get(self, request):
        transactions = MpesaTransaction.objects.all().order_by('-created_at')
        data = [tx.to_json_dict() for tx in transactions]
        return Response({"results": data})


class MpesaBatchVerifyAPIView(APIView):
    """
    Triggered by 'Confirm Multiple Transactions' button in mpesa.html.
    """
    permission_classes = (RolePermission,)
    role_permission_module = 'payment'
    role_permission_actions = {'post': 'update'}

    def post(self, request):
        unsettled = MpesaTransaction.objects.filter(is_settled=False)
        count = 0
        for tx in unsettled:
            if MpesaSettlementEngine.reprocess_unsettled_transaction(tx):
                count += 1
        return Response({"status": "success", "reprocessed_count": count})


class ManualSettlementAPIView(APIView):
    """
    API endpoint to manually reprocess a single transaction.
    """
    permission_classes = (RolePermission,)
    role_permission_module = 'payment'
    role_permission_actions = {'post': 'update'}

    def post(self, request, pk):
        tx = get_object_or_404(MpesaTransaction, pk=pk)
        if tx.is_settled:
            return Response({"status": "warning", "message": f"Transaction {tx.trans_id} is already settled."})
        
        settled = MpesaSettlementEngine.reprocess_unsettled_transaction(tx)
        if settled:
            return Response({"status": "success", "message": f"Successfully settled transaction {tx.trans_id}."})
        else:
            return Response({"status": "error", "message": f"Could not match transaction {tx.trans_id} to a tenant."}, status=400)


class RentCollectionListAPIView(APIView):
    """
    JSON API endpoint for rent collection records (finance.js).
    """
    permission_classes = (RolePermission,)
    role_permission_module = 'payment'

    def get(self, request):
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
                "bank": (
                    "Credit Bank Paybill"
                    if s.transaction.source == 'credit_bank'
                    else "Lipa Na M-Pesa"
                ),
                "refCode": s.transaction.trans_id,
                "type": s.transaction.source,
                "slipDate": s.settled_at.strftime('%Y-%m-%d'),
                "entryDate": s.settled_at.strftime('%Y-%m-%d'),
                "mode": "auto",
                "amount": float(s.amount_applied),
                "balance": float(s.invoice.balance) if s.invoice else 0.0,
                "phone": s.tenant.phone_number
            })
        return Response({"results": data})


class RentCollectionDetailAPIView(APIView):
    """
    JSON API endpoint for single payment receipt detail modal.
    """
    permission_classes = (RolePermission,)
    role_permission_module = 'payment'

    def get(self, request, pk):
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
            "bank": (
                "Credit Bank Paybill"
                if s.transaction.source == 'credit_bank'
                else "Lipa Na M-pesa"
            ),
            "ref_no": s.transaction.trans_id,
            "type": s.transaction.source,
            "slip_date": s.settled_at.strftime('%Y-%m-%d')
        }
        return Response(data)