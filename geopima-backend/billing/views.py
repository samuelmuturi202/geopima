import hmac
import hashlib
import os
from decimal import Decimal, InvalidOperation
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
from config_core.models import CreditBankConfig, MessengerConfig, SMSTemplate
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
from mpesa.models import MpesaTransaction, PaymentSettlement
from properties.models import Property, Unit
from properties.models import MpesaTransaction as LedgerTransaction, PaymentAllocation
from tenants.models import Tenant
from mpesa.services import MpesaSettlementEngine
from config_core.permissions import RolePermission


class DashboardMetricsView(APIView):
    permission_classes = (RolePermission,)
    role_permission_module = 'reports'

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
    permission_classes = (RolePermission,)
    role_permission_module = 'payment'

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
        bank_config = CreditBankConfig.objects.filter(pk=1).first()
        signing_key = (
            (bank_config.signing_key if bank_config else '')
            or os.getenv('CREDIT_BANK_SIGNING_KEY', '')
        ).encode('utf-8')
        if not signing_key:
            return Response(
                {'error': 'Credit Bank webhook signing key is not configured.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not signature_header:
            return Response(
                {'error': 'Missing Credit Bank webhook signature.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        signature = signature_header.removeprefix('sha256=').strip()
        computed_signature = hmac.new(
            signing_key,
            request.body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature.lower(), computed_signature):
            return Response({'error': 'Invalid signature'}, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data
        if not isinstance(data, dict):
            return Response(
                {'error': 'Expected a JSON object for the payment notification.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        trans_id = data.get('transaction_id') or data.get('reference') or data.get('TransID')
        alias = data.get('account_alias') or data.get('bill_ref_number') or data.get('BillRefNumber')
        amount = data.get('amount') or data.get('TransAmount')
        phone = data.get('phone_number') or data.get('msisdn') or data.get('MSISDN')
        sender_name = data.get('sender_name') or data.get('customer_name') or (
            f"{data.get('FirstName', '')} {data.get('LastName', '')}".strip()
        )

        if not trans_id or not alias or not amount:
            return Response(
                {"error": "Missing required fields (transaction_id, account_alias, amount)"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            parsed_amount = Decimal(str(amount))
        except (InvalidOperation, TypeError, ValueError):
            return Response(
                {'error': 'Payment amount must be a valid number.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not parsed_amount.is_finite() or parsed_amount <= 0:
            return Response(
                {'error': 'Payment amount must be greater than zero.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        paybill_number = bank_config.paybill_number if bank_config else '6775'
        received_paybill = (
            data.get('paybill_number')
            or data.get('business_short_code')
            or data.get('BusinessShortCode')
        )
        if received_paybill and str(received_paybill).strip() != paybill_number:
            return Response(
                {'error': 'Payment was sent to a different paybill.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            tx_log, created = SmartAliasTransaction.objects.get_or_create(
                transaction_reference=str(trans_id).strip(),
                defaults={
                    'account_alias': str(alias).strip(),
                    'amount': parsed_amount,
                    'phone_number': str(phone or '').strip(),
                    'sender_name': str(sender_name or '').strip(),
                    'paybill_number': paybill_number,
                    'raw_payload': data,
                },
            )
            if not created:
                if (
                    tx_log.account_alias.casefold() != str(alias).strip().casefold()
                    or tx_log.amount != parsed_amount
                    or tx_log.paybill_number != paybill_number
                ):
                    return Response(
                        {'error': 'Transaction reference was reused with different payment details.'},
                        status=status.HTTP_409_CONFLICT,
                    )
                if tx_log.is_processed:
                    return Response(
                        {'status': 'already_processed'},
                        status=status.HTTP_200_OK,
                    )

            try:
                payment = MpesaSettlementEngine.process_payment({
                    'Source': 'credit_bank',
                    'TransID': str(trans_id).strip(),
                    'TransTime': data.get('transaction_time') or data.get('TransTime', ''),
                    'TransAmount': str(parsed_amount),
                    'BusinessShortCode': paybill_number,
                    'BillRefNumber': str(alias).strip(),
                    'MSISDN': str(phone or '').strip(),
                    'FirstName': data.get('FirstName', ''),
                    'LastName': data.get('LastName', ''),
                })
            except ValueError as error:
                return Response(
                    {'error': str(error)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            tx_log.is_processed = payment.is_settled
            tx_log.save(update_fields=['is_processed'])

        return Response({
            'status': 'success' if tx_log.is_processed else 'received_unmatched',
            'message': (
                'Payment received and allocated to tenant invoices.'
                if tx_log.is_processed else
                'Payment received, but its Smart Alias did not match an active tenant.'
            ),
        }, status=status.HTTP_200_OK)


class VoteHeadViewSet(viewsets.ModelViewSet):
    queryset = VoteHead.objects.all().order_by('priority_order')
    serializer_class = VoteHeadSerializer
    permission_classes = [RolePermission]
    role_permission_module = 'votehead'
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
    permission_classes = [RolePermission]
    role_permission_module = 'fee'
    filter_backends = [filters.SearchFilter]
    search_fields = ['deposit_code', 'reference_no', 'tenant__name', 'tenant__tenant_id']


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related('tenant', 'unit', 'unit__property').all().order_by('-id')
    serializer_class = InvoiceDetailSerializer
    permission_classes = [RolePermission]
    role_permission_module = 'fee'
    role_permission_actions = {
        'add_payment': 'create',
        'generate_monthly': 'create',
    }
    role_permission_action_modules = {
        'add_payment': 'payment',
    }
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

    @action(detail=True, methods=['post'], url_path='add-payment')
    def add_payment(self, request, pk=None):
        invoice = self.get_object()
        reference = str(request.data.get('reference') or '').strip()
        channel = str(request.data.get('channel') or '').strip()
        try:
            amount = Decimal(str(request.data.get('amount')))
        except (InvalidOperation, TypeError, ValueError):
            return Response(
                {'error': 'Payment amount must be a valid number.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not reference:
            return Response(
                {'error': 'Payment reference is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(reference) > 100:
            return Response(
                {'error': 'Payment reference must be 100 characters or fewer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not amount.is_finite() or amount <= 0:
            return Response(
                {'error': 'Payment amount must be greater than zero.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        channel_values = {
            'Mpesa': ('mpesa', 'c2b'),
            'Coop Bank': ('manual', 'bank'),
            'Cash': ('manual', 'cash'),
        }
        if channel not in channel_values:
            return Response(
                {'error': 'Unsupported payment channel.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        source, transaction_type = channel_values[channel]

        with transaction.atomic():
            invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
            if amount > invoice.balance:
                return Response(
                    {'error': 'Payment amount exceeds the invoice balance.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if (
                MpesaTransaction.objects.filter(trans_id=reference).exists()
                or LedgerTransaction.objects.filter(
                    mpesa_receipt_number=reference
                ).exists()
            ):
                return Response(
                    {'error': 'This payment reference has already been recorded.'},
                    status=status.HTTP_409_CONFLICT,
                )

            payment = MpesaTransaction.objects.create(
                trans_id=reference,
                source=source,
                trans_time=timezone.now().isoformat(),
                trans_amount=amount,
                business_short_code=channel[:20],
                bill_ref_number=invoice.tenant.smart_alias,
                msisdn='',
                is_settled=True,
            )
            ledger_transaction = LedgerTransaction.objects.create(
                mpesa_receipt_number=reference,
                transaction_type=transaction_type,
                amount=amount,
                phone_number='',
                account_reference=invoice.tenant.smart_alias or None,
            )
            PaymentAllocation.objects.create(
                invoice=invoice,
                mpesa_transaction=ledger_transaction,
                amount_allocated=amount,
            )
            PaymentSettlement.objects.create(
                transaction=payment,
                tenant=invoice.tenant,
                invoice=invoice,
                receipt_number=MpesaSettlementEngine.generate_monthly_receipt_number(),
                amount_applied=amount,
            )
            invoice.save(update_fields=['status'])

        return Response(
            {
                'status': 'success',
                'invoice_id': str(invoice.pk),
                'amount': str(amount),
                'reference': reference,
                'channel': channel,
                'balance': str(invoice.balance),
            },
            status=status.HTTP_201_CREATED,
        )

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
    permission_classes = [RolePermission]
    role_permission_module = 'message'
    role_permission_actions = {
        'service_status': 'access',
        'generate': 'create',
        'approve': 'update',
        'send': 'update',
    }
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

    @action(detail=False, methods=['get'], url_path='service-status')
    def service_status(self, request):
        config = MessengerConfig.objects.filter(pk=1).first()
        missing = []

        if not config or (config.service_provider or '').strip().casefold() not in {
            'celcom africa', 'celcom'
        }:
            missing.append('SMS gateway set to Celcom Africa')
        if not config or not config.partner_id:
            missing.append('Celcom Partner ID')
        if not config or not config.partner_key:
            missing.append('Celcom API key')
        if not config or not config.sender_id:
            missing.append('Celcom-approved Sender ID')

        saved_categories = set(
            SMSTemplate.objects.filter(
                category__in=['FEE_REMINDER', 'LANDLORD_UPDATE']
            ).values_list('category', flat=True)
        )
        for category, label in (
            ('FEE_REMINDER', 'tenant rent reminder template'),
            ('LANDLORD_UPDATE', 'landlord summary template'),
        ):
            if category not in saved_categories:
                missing.append(label)

        gateway_ready = not any(
            item in missing
            for item in (
                'SMS gateway set to Celcom Africa',
                'Celcom Partner ID',
                'Celcom API key',
                'Celcom-approved Sender ID',
            )
        )
        templates_ready = not any(
            item in missing
            for item in (
                'tenant rent reminder template',
                'landlord summary template',
            )
        )
        return Response({
            'provider': config.service_provider if config else None,
            'gateway_ready': gateway_ready,
            'templates_ready': templates_ready,
            'ready': gateway_ready and templates_ready,
            'missing': missing,
            'message': (
                'Celcom SMS is ready. Drafts still require approval before sending.'
                if not missing else
                'Complete SMS setup in Configuration > Agency Profile > SMS Configurations'
                ' and Configuration > SMS Templates.'
            ),
        }, status=status.HTTP_200_OK)

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