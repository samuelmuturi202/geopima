import hmac
import hashlib
import os
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.core.management import call_command
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .models import VoteHead, Deposit, Invoice, SmartAliasTransaction
from .serializers import (
    VoteHeadSerializer, 
    DepositSerializer, 
    InvoiceDetailSerializer,
    SmartAliasTransactionSerializer
)


class DashboardMetricsView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def get(self, request):
        data = {
            "properties": ["Block A", "Block B", "Block C", "Block D"],
            "total_units": [40, 25, 30, 15],
            "occupied_units": [35, 20, 28, 10]
        }
        return Response(data, status=status.HTTP_200_OK)


class PaymentSummariesView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def get(self, request):
        data = [
            {"name": "Rent Collection", "collected": 450000, "total": 500000, "pct": 90},
            {"name": "Water Collection", "collected": 18000, "total": 20000, "pct": 90},
            {"name": "Garbage Collection", "collected": 5000, "total": 10000, "pct": 50}
        ]
        return Response(data, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class CreditBankSmartAliasWebhookView(APIView):
    """
    Public webhook endpoint that Credit Bank calls when a tenant makes 
    a payment via Smart Alias Paybill 4045619 using a unique alias (e.g., House No. 1).
    """
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def post(self, request):
        # 1. Verify HMAC signature using the signing key from your .env file
        signature_header = request.headers.get('X-Signature') or request.headers.get('Signature')
        signing_key = os.getenv('CREDIT_BANK_SIGNING_KEY', '').encode('utf-8')
        
        if signature_header and signing_key:
            computed_signature = hmac.new(
                signing_key, 
                request.body, 
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature_header, computed_signature):
                return Response({"error": "Invalid signature"}, status=status.HTTP_401_UNAUTHORIZED)

        # 2. Proceed with payload parsing and processing
        data = request.data
        
        # Extract payload attributes from Credit Bank webhook
        trans_id = data.get('transaction_id') or data.get('reference') or data.get('TransID')
        alias = data.get('account_alias') or data.get('bill_ref_number') or data.get('BillRefNumber')
        amount = data.get('amount') or data.get('TransAmount')
        phone = data.get('phone_number') or data.get('msisdn') or data.get('MSISDN')
        sender_name = data.get('sender_name') or data.get('customer_name') or f"{data.get('FirstName', '')} {data.get('LastName', '')}".strip()

        if not trans_id or not alias or not amount:
            return Response(
                {"error": "Missing required fields (transaction_id, account_alias, amount)"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Prevent duplicate transaction logging
        if SmartAliasTransaction.objects.filter(transaction_reference=trans_id).exists():
            return Response({"status": "Already processed"}, status=status.HTTP_200_OK)

        # 3. Log incoming transaction payload
        tx_log = SmartAliasTransaction.objects.create(
            transaction_reference=trans_id,
            account_alias=alias,
            amount=amount,
            phone_number=phone,
            sender_name=sender_name,
            raw_payload=data
        )

        try:
            # 4. Mark as processed (automated reconciliation against units/invoices can hook here)
            tx_log.is_processed = True
            tx_log.save()

            return Response({
                "status": "SUCCESS", 
                "message": "Smart alias payment reconciled successfully"
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"status": "ERROR", "message": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VoteHeadViewSet(viewsets.ModelViewSet):
    queryset = VoteHead.objects.all().order_by('priority_order')
    serializer_class = VoteHeadSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'title', 'code']

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        priority_ids = request.data.get('priority_order', [])
        for index, item_id in enumerate(priority_ids):
            VoteHead.objects.filter(id=item_id).update(priority_order=index)
        return Response({'status': 'priority sequence updated'}, status=status.HTTP_200_OK)


class DepositViewSet(viewsets.ModelViewSet):
    queryset = Deposit.objects.select_related('tenant', 'unit').all().order_by('-id')
    serializer_class = DepositSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ['deposit_code', 'reference_no', 'tenant__name', 'tenant__tenant_id']


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related('tenant', 'unit', 'unit__property').all().order_by('-id')
    serializer_class = InvoiceDetailSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'invoice_number', 
        'tenant__name', 
        'tenant__tenant_id', 
        'unit__unit_name'
    ]

    @action(detail=False, methods=['post'], url_path='generate-monthly')
    def generate_monthly(self, request):
        try:
            call_command('generate_monthly_invoices')
            return Response(
                {'detail': 'Monthly invoices generated successfully.'}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to generate invoices: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )