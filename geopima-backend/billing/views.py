import hmac
import hashlib
import os
from decimal import Decimal
from rest_framework import viewsets, filters, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.core.management import call_command
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.db.models import Sum, Count, Q
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .communication import generate_communication_drafts
from .models import VoteHead, Deposit, Invoice, SmartAliasTransaction, CommunicationDraft
from config_core.models import MessengerConfig
from config_core.sms_gateway import (
    SMSDeliveryRejected,
    SMSDeliveryUncertain,
    SMSGatewayConfigurationError,
    send_sms,
)
from .serializers import (
    VoteHeadSerializer, 
    DepositSerializer, 
    InvoiceDetailSerializer,
    SmartAliasTransactionSerializer,
    CommunicationDraftSerializer,
)
from properties.models import Property, Unit
from tenants.models import Tenant


class DashboardMetricsView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def get(self, request):
        try:
            properties = Property.objects.all()
            prop_names = []
            total_units_list = []
            occupied_units_list = []

            for prop in properties:
                prop_names.append(prop.name)
                t_units = prop.units.count() if hasattr(prop, 'units') else 0
                o_units = prop.units.filter(is_occupied=True).count() if hasattr(prop, 'units') else 0
                total_units_list.append(t_units)
                occupied_units_list.append(o_units)

            # Calculate main financial stats from database
            total_expected_rent = Invoice.objects.aggregate(total=Sum('items__amount'))['total'] or Decimal('0.00')
            total_collected_rent = Invoice.objects.aggregate(collected=Sum('allocations__amount_allocated'))['collected'] or Decimal('0.00')
            rent_due = total_expected_rent - total_collected_rent if total_expected_rent > total_collected_rent else Decimal('0.00')

            data = {
                "properties": prop_names,
                "total_units": total_units_list,
                "occupied_units": occupied_units_list,
                "summary_counts": {
                    "landlords": Property.objects.values('landlord').distinct().count() if hasattr(Property, 'landlord') else 0,
                    "properties": Property.objects.count(),
                    "units": Unit.objects.count(),
                    "occupied_units": Unit.objects.filter(is_occupied=True).count(),
                    "tenants": Tenant.objects.count(),
                    "suspended": Tenant.objects.filter(status='suspended').count() if hasattr(Tenant, 'status') else 0
                },
                "financial_matrix": {
                    "expected_rent": float(total_expected_rent),
                    "collected_rent": float(total_collected_rent),
                    "rent_due": float(rent_due)
                }
            }
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Failed to retrieve dashboard metrics: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PaymentSummariesView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def get(self, request):
        try:
            properties = Property.objects.all()
            payment_summaries = []

            for prop in properties:
                prop_invoices = Invoice.objects.filter(unit__property=prop)
                expected = prop_invoices.aggregate(total=Sum('items__amount'))['total'] or Decimal('0.00')
                collected = prop_invoices.aggregate(total=Sum('allocations__amount_allocated'))['total'] or Decimal('0.00')
                
                pct = int((float(collected) / float(expected)) * 100) if expected > 0 else 0

                payment_summaries.append({
                    "name": prop.name,
                    "collected": float(collected),
                    "total": float(expected),
                    "pct": min(pct, 100)
                })

            return Response(payment_summaries, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Failed to retrieve payment summaries: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class CreditBankSmartAliasWebhookView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def post(self, request):
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

        data = request.data
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

        if SmartAliasTransaction.objects.filter(transaction_reference=trans_id).exists():
            return Response({"status": "Already processed"}, status=status.HTTP_200_OK)

        tx_log = SmartAliasTransaction.objects.create(
            transaction_reference=trans_id,
            account_alias=alias,
            amount=amount,
            phone_number=phone,
            sender_name=sender_name,
            raw_payload=data
        )

        try:
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

    def get_queryset(self):
        qs = super().get_queryset()
        property_name = self.request.query_params.get('property')
        period = self.request.query_params.get('period')
        status_filter = self.request.query_params.get('status')
        cluster = self.request.query_params.get('cluster')

        if property_name and property_name.upper() != 'ALL':
            qs = qs.filter(unit__property__name__iexact=property_name)
        
        if period and period.upper() != 'ALL':
            try:
                parts = period.split('-')
                if len(parts) == 2:
                    month_str, year_str = parts
                    from datetime import datetime
                    dt = datetime.strptime(f"1-{month_str}-{year_str}", "%d-%B-%Y")
                    qs = qs.filter(billing_period__year=dt.year, billing_period__month=dt.month)
            except Exception:
                pass

        if cluster and cluster.upper() != 'ALL':
            if hasattr(Invoice.unit.field.related_model, 'property'):
                qs = qs.filter(unit__property__cluster__iexact=cluster)

        return qs

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


class CommunicationDraftViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = CommunicationDraftSerializer
    permission_classes = [IsAuthenticated]
    queryset = CommunicationDraft.objects.select_related(
        'invoice__unit__property', 'landlord'
    ).order_by('-created_at')

    def get_queryset(self):
        queryset = self.queryset
        draft_status = self.request.query_params.get('status')
        recipient_type = self.request.query_params.get('recipient_type')
        if draft_status in {'pending', 'approved', 'sent', 'failed', 'unknown'}:
            queryset = queryset.filter(status=draft_status)
        if recipient_type in {'tenant', 'landlord'}:
            queryset = queryset.filter(recipient_type=recipient_type)
        return queryset

    @action(detail=False, methods=['post'], url_path='generate')
    def generate(self, request):
        totals = generate_communication_drafts(
            created_by=request.user,
            include_landlord_summaries=True,
        )
        return Response({
            **totals,
            'run_date': timezone.localdate(),
            'message': (
                'Draft generation complete, including the previous-month landlord '
                'summary. No SMS messages were sent.'
            ),
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        draft = self.get_object()
        if draft.status != 'pending':
            return Response(
                {'error': 'Only pending drafts can be approved.'},
                status=status.HTTP_409_CONFLICT,
            )
        draft.status = 'approved'
        draft.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(draft).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='send')
    def send(self, request, pk=None):
        with transaction.atomic():
            draft = get_object_or_404(
                self.get_queryset().select_for_update(),
                pk=pk,
            )
            if draft.status not in {'approved', 'failed'}:
                return Response(
                    {'error': 'Only approved drafts or provider-rejected drafts can be sent.'},
                    status=status.HTTP_409_CONFLICT,
                )

            messenger_config, _ = MessengerConfig.objects.get_or_create(id=1)
            try:
                delivery = send_sms(
                    messenger_config,
                    draft.phone_number,
                    draft.message,
                )
            except SMSGatewayConfigurationError as error:
                return Response({'error': str(error)}, status=status.HTTP_400_BAD_REQUEST)
            except SMSDeliveryRejected as error:
                draft.status = 'failed'
                draft.save(update_fields=['status', 'updated_at'])
                return Response({'error': str(error)}, status=status.HTTP_502_BAD_GATEWAY)
            except SMSDeliveryUncertain as error:
                draft.status = 'unknown'
                draft.save(update_fields=['status', 'updated_at'])
                return Response({'error': str(error)}, status=status.HTTP_502_BAD_GATEWAY)

            draft.status = 'sent'
            draft.provider_message_id = delivery.message_id
            draft.sent_at = timezone.now()
            draft.save(update_fields=[
                'status', 'provider_message_id', 'sent_at', 'updated_at'
            ])

        return Response(self.get_serializer(draft).data, status=status.HTTP_200_OK)