import hmac
import hashlib
import csv
import io
import os
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from rest_framework import viewsets, filters, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.core.management import call_command
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.db.models import Sum, Count, Q, Exists, OuterRef
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .communication import generate_communication_drafts
from .models import (
    VoteHead, Deposit, Invoice, SmartAliasTransaction, CommunicationDraft,
    CoopStatementUpload, InvoiceItem,
)
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
    InvoiceItemSerializer,
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


class CoopStatementAPIView(APIView):
    permission_classes = (RolePermission,)
    role_permission_module = 'payment'
    max_upload_bytes = 5 * 1024 * 1024
    max_rows = 10000
    field_aliases = {
        'date': {'date', 'transaction_date', 'paid_on'},
        'code': {'code', 'transaction_code', 'transaction_id'},
        'tenantNo': {'tenant_no', 'tenant_number', 'account_number', 'account_alias'},
        'tenant': {'tenant', 'tenant_name', 'customer_name'},
        'phone': {'phone', 'phone_number', 'mobile'},
        'paidBy': {'paid_by', 'payer_name', 'sender_name'},
        'paymentRef': {'payment_ref', 'payment_reference', 'reference', 'receipt', 'receipt_number'},
        'narration': {'narration', 'description', 'remarks'},
        'amount': {'amount', 'transaction_amount', 'credit'},
    }

    def get(self, request):
        search = request.query_params.get('search', '').strip().casefold()
        entries = []
        for upload in CoopStatementUpload.objects.all():
            for entry in upload.entries:
                row = {**entry, 'file_name': upload.file_name, 'uploaded_at': upload.created_at}
                if not search or search in ' '.join(str(value) for value in row.values()).casefold():
                    entries.append(row)
        return Response(entries)

    def post(self, request):
        uploaded_file = request.FILES.get('statement')
        if not uploaded_file:
            return Response({'statement': 'Choose a CSV statement file.'}, status=status.HTTP_400_BAD_REQUEST)
        if not uploaded_file.name.lower().endswith('.csv'):
            return Response({'statement': 'Only CSV statement files are supported.'}, status=status.HTTP_400_BAD_REQUEST)
        if uploaded_file.size > self.max_upload_bytes:
            return Response({'statement': 'CSV files must be 5 MB or smaller.'}, status=status.HTTP_400_BAD_REQUEST)

        content = uploaded_file.read()
        if len(content) > self.max_upload_bytes:
            return Response({'statement': 'CSV files must be 5 MB or smaller.'}, status=status.HTTP_400_BAD_REQUEST)
        content_hash = hashlib.sha256(content).hexdigest()
        if CoopStatementUpload.objects.filter(content_hash=content_hash).exists():
            return Response({'statement': 'This statement file has already been imported.'}, status=status.HTTP_409_CONFLICT)
        try:
            decoded = content.decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(decoded))
            if not reader.fieldnames:
                raise ValueError('The CSV must include a header row.')
            normalized_headers = {
                header.strip().lower().replace(' ', '_'): header
                for header in reader.fieldnames
                if header
            }
            canonical_headers = {}
            for canonical, aliases in self.field_aliases.items():
                source_header = next(
                    (normalized_headers[name] for name in aliases if name in normalized_headers),
                    None,
                )
                if source_header:
                    canonical_headers[canonical] = source_header
            if 'amount' not in canonical_headers:
                raise ValueError('Include an amount column (amount, transaction_amount, or credit).')

            entries = []
            for row_number, raw_row in enumerate(reader, start=2):
                if len(entries) >= self.max_rows:
                    raise ValueError(f'CSV files may contain at most {self.max_rows} rows.')
                if not any((value or '').strip() for value in raw_row.values()):
                    continue
                entry = {
                    field: (raw_row.get(source) or '').strip()
                    for field, source in canonical_headers.items()
                }
                try:
                    amount = Decimal(entry['amount'].replace(',', '').replace('KES', '').strip())
                    entry['amount'] = str(amount.quantize(Decimal('0.01')))
                except (InvalidOperation, TypeError, ValueError):
                    raise ValueError(f'Row {row_number} has an invalid amount.')
                if not amount.is_finite() or amount <= 0:
                    raise ValueError(f'Row {row_number} amount must be greater than zero.')
                entries.append(entry)
            if not entries:
                raise ValueError('The CSV contains no transaction rows.')
        except (UnicodeDecodeError, csv.Error, ValueError) as error:
            return Response({'statement': str(error)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            upload = CoopStatementUpload.objects.create(
                file_name=os.path.basename(uploaded_file.name.replace('\\', '/')),
                content_hash=content_hash,
                entries=entries,
                uploaded_by=request.user,
            )
        except IntegrityError:
            return Response(
                {'statement': 'This statement file has already been imported.'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(
            {'id': upload.pk, 'file_name': upload.file_name, 'row_count': len(entries)},
            status=status.HTTP_201_CREATED,
        )


class DiscountListAPIView(APIView):
    permission_classes = (RolePermission,)
    role_permission_module = 'fee'

    def get(self, request):
        items = InvoiceItem.objects.filter(
            Q(item_type__icontains='discount')
            | Q(description__icontains='discount')
        ).select_related(
            'invoice__tenant',
            'invoice__unit__property',
            'invoice__unit__property__landlord',
        ).order_by('-invoice__billing_period')
        search = request.query_params.get('search', '').strip()
        if search:
            items = items.filter(
                Q(invoice__invoice_number__icontains=search)
                | Q(invoice__tenant__tenant_id__icontains=search)
                | Q(invoice__tenant__name__icontains=search)
                | Q(invoice__unit__unit_name__icontains=search)
                | Q(invoice__unit__property__name__icontains=search)
                | Q(item_type__icontains=search)
                | Q(description__icontains=search)
            )
        return Response([
            {
                'invoice': item.invoice.invoice_number,
                'landlordName': item.invoice.unit.property.landlord.name,
                'propertyName': item.invoice.unit.property.name,
                'cluster': item.invoice.unit.property.cluster,
                'unitName': item.invoice.unit.unit_name,
                'tenantId': item.invoice.tenant.tenant_id,
                'tenantName': item.invoice.tenant.name,
                'discountName': item.item_type,
                'description': item.description,
                'discount': str(abs(item.amount)),
                'details': item.invoice.billing_period.strftime('%B-%Y'),
            }
            for item in items
        ])


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
        'add_item': 'create',
        'request_payment': 'create',
        'offer_discount': 'update',
        'change_month': 'update',
        'generate_monthly': 'create',
        'tenants_without_invoices': 'access',
    }
    role_permission_action_modules = {
        'add_payment': 'payment',
        'request_payment': 'message',
        'tenants_without_invoices': 'tenant',
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

    @action(detail=False, methods=['get'], url_path='tenants-without-invoices')
    def tenants_without_invoices(self, request):
        from datetime import datetime

        period = request.query_params.get('period', '').strip()
        try:
            if period and period.upper() != 'ALL':
                month_name, year = period.split('-', 1)
                billing_period = datetime.strptime(
                    f'1-{month_name}-{year}', '%d-%B-%Y'
                ).date()
            else:
                billing_period = timezone.localdate().replace(day=1)
        except (ValueError, TypeError):
            return Response(
                {'period': 'Use a month and year, for example August-2025.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_invoice = Invoice.objects.filter(
            tenant_id=OuterRef('tenant_id'),
            unit_id=OuterRef('unit_id'),
            billing_period__year=billing_period.year,
            billing_period__month=billing_period.month,
        )
        tenants = Tenant.objects.filter(
            status='active',
            unit__isnull=False,
        ).annotate(
            has_invoice=Exists(existing_invoice),
        ).filter(
            has_invoice=False,
        ).select_related('unit__property').order_by('name')
        return Response([
            {
                'tenant_id': tenant.tenant_id,
                'tenant_name': tenant.name,
                'property_name': tenant.unit.property.name,
                'unit_name': tenant.unit.unit_name,
                'billing_period': billing_period.strftime('%B-%Y').upper(),
            }
            for tenant in tenants
        ])

    @action(detail=True, methods=['post'], url_path='add-item')
    def add_item(self, request, pk=None):
        invoice = self.get_object()
        item_type = str(request.data.get('item_type') or '').strip()
        description = str(request.data.get('description') or '').strip()
        try:
            amount = Decimal(str(request.data.get('amount')))
        except (InvalidOperation, TypeError, ValueError):
            return Response({'amount': 'Enter a valid amount.'}, status=status.HTTP_400_BAD_REQUEST)
        if not item_type or len(item_type) > 50:
            return Response({'item_type': 'Enter an item type of 1 to 50 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        if 'discount' in item_type.casefold():
            return Response(
                {'item_type': 'Discounts cannot be added as positive invoice charges.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not description or len(description) > 255:
            return Response({'description': 'Enter a description of 1 to 255 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        if not amount.is_finite() or amount <= 0 or amount > Decimal('9999999999.99'):
            return Response({'amount': 'Amount must be greater than zero and within the supported range.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            quantized_amount = amount.quantize(Decimal('0.01'))
        except InvalidOperation:
            return Response({'amount': 'Amount may have no more than two decimal places.'}, status=status.HTTP_400_BAD_REQUEST)
        if quantized_amount != amount:
            return Response({'amount': 'Amount may have no more than two decimal places.'}, status=status.HTTP_400_BAD_REQUEST)
        amount = quantized_amount

        with transaction.atomic():
            item = InvoiceItem.objects.create(
                invoice=invoice,
                item_type=item_type,
                description=description,
                amount=amount,
            )
            invoice.save(update_fields=['status'])
        return Response(InvoiceItemSerializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='offer-discount')
    def offer_discount(self, request, pk=None):
        try:
            percentage = Decimal(str(request.data.get('percentage')))
        except (InvalidOperation, TypeError, ValueError):
            return Response({'percentage': 'Enter a valid discount percentage.'}, status=status.HTTP_400_BAD_REQUEST)
        if not percentage.is_finite() or percentage <= 0 or percentage > 100:
            return Response(
                {'percentage': 'Discount percentage must be greater than 0 and no more than 100.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invoice_id = self.get_object().pk
        with transaction.atomic():
            invoice = Invoice.objects.select_for_update().get(pk=invoice_id)
            if invoice.rent_paid > 0 or invoice.status in {'paid', 'partially_paid'}:
                return Response(
                    {'invoice': 'A discount cannot be applied after a payment has been recorded.'},
                    status=status.HTTP_409_CONFLICT,
                )
            if invoice.items.filter(item_type='Discount').exists():
                return Response(
                    {'invoice': 'A percentage discount has already been applied to this invoice.'},
                    status=status.HTTP_409_CONFLICT,
                )
            subtotal = invoice.subtotal
            if subtotal <= 0:
                return Response(
                    {'invoice': 'A discount requires a positive invoice subtotal.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            discount_amount = (subtotal * percentage / Decimal('100')).quantize(
                Decimal('0.01'),
                rounding=ROUND_HALF_UP,
            )
            if discount_amount <= 0:
                return Response(
                    {'percentage': 'This percentage is too small to produce a one-cent discount.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if discount_amount > Decimal('9999999999.99'):
                return Response(
                    {'percentage': 'The discount exceeds the supported invoice item amount.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if discount_amount > invoice.net_total:
                return Response(
                    {'percentage': 'The discount cannot exceed the remaining invoice total.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            item = InvoiceItem.objects.create(
                invoice=invoice,
                item_type='Discount',
                description=f'{format(percentage.normalize(), "f")}% invoice discount',
                amount=-discount_amount,
            )
            invoice.save(update_fields=['status'])
        return Response(InvoiceItemSerializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='change-month')
    def change_month(self, request, pk=None):
        from calendar import monthrange
        from datetime import datetime

        period = str(request.data.get('period') or '').strip()
        if (
            len(period) != 7
            or period[4] != '-'
            or not period[:4].isdigit()
            or not period[5:].isdigit()
        ):
            return Response(
                {'period': 'Use YYYY-MM format, for example 2026-08.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            target_period = datetime.strptime(f'{period}-01', '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'period': 'Enter a valid month in YYYY-MM format.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invoice_id = self.get_object().pk
        try:
            with transaction.atomic():
                invoice = Invoice.objects.select_for_update().get(pk=invoice_id)
                if invoice.rent_paid > 0 or invoice.status in {'paid', 'partially_paid'}:
                    return Response(
                        {'invoice': 'The month cannot be changed after a payment has been recorded.'},
                        status=status.HTTP_409_CONFLICT,
                    )
                if Invoice.objects.filter(
                    tenant_id=invoice.tenant_id,
                    unit_id=invoice.unit_id,
                    billing_period__year=target_period.year,
                    billing_period__month=target_period.month,
                ).exclude(pk=invoice.pk).exists():
                    return Response(
                        {'period': 'An invoice already exists for this tenant and unit in the selected month.'},
                        status=status.HTTP_409_CONFLICT,
                    )

                month_offset = (
                    (target_period.year - invoice.billing_period.year) * 12
                    + target_period.month
                    - invoice.billing_period.month
                )
                due_month_index = invoice.due_date.year * 12 + invoice.due_date.month - 1 + month_offset
                due_year, due_month_index = divmod(due_month_index, 12)
                due_month = due_month_index + 1
                due_day = min(invoice.due_date.day, monthrange(due_year, due_month)[1])
                invoice.billing_period = target_period
                invoice.due_date = invoice.due_date.replace(
                    year=due_year,
                    month=due_month,
                    day=due_day,
                )
                invoice.save(update_fields=['billing_period', 'due_date', 'status'])
        except IntegrityError as error:
            diagnostics = getattr(error.__cause__, 'diag', None)
            if getattr(diagnostics, 'constraint_name', None) != 'unique_invoice_tenant_unit_period':
                raise
            return Response(
                {'period': 'An invoice already exists for this tenant and unit in the selected month.'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(InvoiceDetailSerializer(invoice).data)

    @action(detail=True, methods=['post'], url_path='request-payment')
    def request_payment(self, request, pk=None):
        invoice = self.get_object()
        tenant = invoice.tenant
        if not tenant.phone_number:
            return Response(
                {'phone_number': 'Add a phone number to the tenant before creating a payment request.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if invoice.balance <= 0:
            return Response(
                {'invoice': 'A payment request is only available when the invoice has a balance.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bank_config = CreditBankConfig.objects.filter(pk=1).first()
        paybill = bank_config.paybill_number if bank_config else '6775'
        message = (
            f"Payment reminder for invoice {invoice.invoice_number}: "
            f"KES {invoice.balance:.2f} is due. Pay via Paybill {paybill}, "
            f"account {tenant.smart_alias or tenant.tenant_id}."
        )
        draft, created = CommunicationDraft.objects.get_or_create(
            invoice=invoice,
            reminder_type='rent_due',
            defaults={
                'recipient_type': 'tenant',
                'recipient_name': tenant.name,
                'phone_number': tenant.phone_number,
                'message': message,
                'status': 'pending',
                'period': invoice.billing_period,
                'created_by': request.user,
            },
        )
        if not created and draft.status != 'pending':
            return Response(
                {'draft': 'A payment reminder for this invoice already exists and is no longer pending.'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(
            CommunicationDraftSerializer(draft).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

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