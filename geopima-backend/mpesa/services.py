from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Value
from django.db.models.functions import Concat
from django.utils import timezone

from billing.models import Invoice
from properties.models import MpesaTransaction as LedgerTransaction, PaymentAllocation
from tenants.models import Tenant
from tenants.utils import build_smart_alias

from .models import MpesaTransaction, PaymentSettlement


class MpesaSettlementEngine:

    @classmethod
    def generate_monthly_receipt_number(cls) -> str:
        prefix = timezone.localdate().strftime('%Y%m')
        last_settlement = (
            PaymentSettlement.objects.select_for_update()
            .filter(receipt_number__startswith=prefix)
            .order_by('-receipt_number')
            .first()
        )
        if last_settlement and last_settlement.receipt_number:
            try:
                seq = int(last_settlement.receipt_number[-4:]) + 1
            except ValueError:
                seq = 3556
        else:
            seq = 3556
        return f'{prefix}{seq:04d}'

    @classmethod
    @transaction.atomic
    def process_payment(cls, trans_data: dict) -> MpesaTransaction:
        trans_id = str(trans_data.get('TransID') or '').strip()
        if not trans_id:
            raise ValueError('Transaction reference is required.')

        try:
            amount = Decimal(str(trans_data.get('TransAmount', '0.00')))
        except (InvalidOperation, TypeError, ValueError) as error:
            raise ValueError('Transaction amount must be a valid number.') from error
        if not amount.is_finite() or amount <= 0:
            raise ValueError('Transaction amount must be greater than zero.')

        source = trans_data.get('Source') or 'mpesa'
        if source not in {'mpesa', 'credit_bank', 'manual'}:
            raise ValueError('Unsupported payment source.')

        mpesa_tx, created = MpesaTransaction.objects.get_or_create(
            trans_id=trans_id,
            defaults={
                'source': source,
                'trans_time': str(trans_data.get('TransTime') or ''),
                'trans_amount': amount,
                'business_short_code': str(trans_data.get('BusinessShortCode') or ''),
                'bill_ref_number': str(trans_data.get('BillRefNumber') or '').strip(),
                'msisdn': str(trans_data.get('MSISDN') or '').strip(),
                'first_name': str(trans_data.get('FirstName') or '').strip(),
                'last_name': str(trans_data.get('LastName') or '').strip(),
            },
        )

        if not created and (
            mpesa_tx.source != source
            or mpesa_tx.trans_amount != amount
            or mpesa_tx.business_short_code
            != str(trans_data.get('BusinessShortCode') or '')
            or mpesa_tx.bill_ref_number
            != str(trans_data.get('BillRefNumber') or '').strip()
        ):
            raise ValueError(
                'Transaction reference was reused with different payment details.'
            )

        if not created and mpesa_tx.is_settled:
            return mpesa_tx

        cls.settle_transaction(mpesa_tx)
        return mpesa_tx

    @classmethod
    def reprocess_unsettled_transaction(cls, mpesa_tx: MpesaTransaction) -> bool:
        if mpesa_tx.is_settled:
            return True
        return cls.settle_transaction(mpesa_tx)

    @classmethod
    def _find_tenants(cls, reference: str, phone_number: str):
        active_tenants = Tenant.objects.filter(status='active')
        if reference:
            matches = list(
                active_tenants.filter(smart_alias__iexact=reference)
                .select_related('unit')
            )
            if matches:
                return matches

            legacy_aliases = active_tenants.annotate(
                legacy_smart_alias=Concat(
                    'unit__property__property_id',
                    Value('-'),
                    'unit__unit_name',
                )
            )
            matches = list(
                legacy_aliases.filter(
                    legacy_smart_alias__iexact=reference
                ).select_related('unit')
            )
            if matches:
                return matches

            tenant = Tenant.objects.filter(tenant_id__iexact=reference).first()
            if tenant:
                return [tenant]

            matches = list(
                active_tenants.filter(unit__unit_name__iexact=reference)
                .select_related('unit')[:2]
            )
            if len(matches) == 1:
                return matches

        if phone_number:
            matches = list(
                active_tenants.filter(phone_number=phone_number)
                .select_related('unit')[:2]
            )
            if len(matches) == 1:
                return matches
        return []

    @classmethod
    @transaction.atomic
    def settle_transaction(cls, mpesa_tx: MpesaTransaction) -> bool:
        ledger_transaction, _ = LedgerTransaction.objects.get_or_create(
            mpesa_receipt_number=mpesa_tx.trans_id,
            defaults={
                'transaction_type': mpesa_tx.source,
                'amount': mpesa_tx.trans_amount,
                'phone_number': mpesa_tx.msisdn or '',
                'account_reference': mpesa_tx.bill_ref_number[:100] or None,
            },
        )

        if PaymentAllocation.objects.filter(
            mpesa_transaction=ledger_transaction
        ).exists():
            mpesa_tx.is_settled = True
            mpesa_tx.save(update_fields=['is_settled'])
            return True

        tenants = cls._find_tenants(
            mpesa_tx.bill_ref_number.strip(),
            mpesa_tx.msisdn.strip(),
        )
        if not tenants:
            return False

        remaining_amount = mpesa_tx.trans_amount
        invoice_ids = [tenant.tenant_id for tenant in tenants]
        invoices = Invoice.objects.select_for_update().filter(
            tenant_id__in=invoice_ids
        ).order_by('due_date', 'billing_period', 'created_at')

        for invoice in invoices:
            if remaining_amount <= 0:
                break

            balance = invoice.balance
            if balance <= 0:
                continue

            amount_applied = min(remaining_amount, balance)
            PaymentAllocation.objects.create(
                invoice=invoice,
                mpesa_transaction=ledger_transaction,
                amount_allocated=amount_applied,
            )
            invoice.save(update_fields=['status'])
            PaymentSettlement.objects.create(
                transaction=mpesa_tx,
                tenant=invoice.tenant,
                invoice=invoice,
                receipt_number=cls.generate_monthly_receipt_number(),
                amount_applied=amount_applied,
            )
            remaining_amount -= amount_applied

        mpesa_tx.is_settled = True
        mpesa_tx.save(update_fields=['is_settled'])
        return True
