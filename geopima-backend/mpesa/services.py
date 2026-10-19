from decimal import Decimal
from django.db import transaction
from tenants.models import Tenant
from billing.models import Invoice
from .models import MpesaTransaction, PaymentSettlement


class MpesaSettlementEngine:

    @classmethod
    @transaction.atomic
    def process_payment(cls, trans_data: dict) -> MpesaTransaction:
        """
        Parses incoming M-Pesa payload, creates transaction entry, and triggers settlement.
        """
        mpesa_tx, created = MpesaTransaction.objects.get_or_create(
            trans_id=trans_data.get('TransID'),
            defaults={
                'trans_time': trans_data.get('TransTime', ''),
                'trans_amount': Decimal(str(trans_data.get('TransAmount', '0.00'))),
                'business_short_code': trans_data.get('BusinessShortCode', ''),
                'bill_ref_number': trans_data.get('BillRefNumber', '').strip(),
                'msisdn': trans_data.get('MSISDN', ''),
                'first_name': trans_data.get('FirstName', ''),
                'last_name': trans_data.get('LastName', ''),
            }
        )

        if not created and mpesa_tx.is_settled:
            return mpesa_tx  # Prevent duplicate settlements

        cls.settle_transaction(mpesa_tx)
        return mpesa_tx

    @classmethod
    def reprocess_unsettled_transaction(cls, mpesa_tx: MpesaTransaction) -> bool:
        """
        Manually re-triggers settlement logic for an unsettled transaction.
        """
        if mpesa_tx.is_settled:
            return True
        return cls.settle_transaction(mpesa_tx)

    @classmethod
    def settle_transaction(cls, mpesa_tx: MpesaTransaction) -> bool:
        """
        Matches transaction against tenants and applies payment towards open invoices.
        """
        ref_code = mpesa_tx.bill_ref_number
        tenant = Tenant.objects.filter(unit__unit_name__iexact=ref_code).first()

        if not tenant:
            tenant = Tenant.objects.filter(tenant_id__iexact=ref_code).first()

        if not tenant:
            tenant = Tenant.objects.filter(phone_number=mpesa_tx.msisdn).first()

        if not tenant:
            return False  # Remained unmatched

        unpaid_invoices = Invoice.objects.filter(
            tenant=tenant
        ).exclude(status='PAID').order_by('created_at')

        remaining_balance = mpesa_tx.trans_amount

        for invoice in unpaid_invoices:
            if remaining_balance <= 0:
                break

            due = invoice.balance
            if due <= 0:
                continue

            payment_amount = min(remaining_balance, due)
            invoice.paid_amount += payment_amount
            invoice.update_status()

            remaining_balance -= payment_amount

            PaymentSettlement.objects.create(
                transaction=mpesa_tx,
                tenant=tenant,
                invoice=invoice,
                amount_applied=payment_amount
            )

        mpesa_tx.is_settled = True
        mpesa_tx.save()
        return True