from django.test import TestCase

# Create your tests here.
from datetime import date
from decimal import Decimal

from django.test import TestCase

from billing.models import Invoice, InvoiceItem
from properties.models import Landlord, MpesaTransaction as LedgerTransaction, PaymentAllocation, Property, Unit
from tenants.models import Tenant

from .models import MpesaTransaction, PaymentSettlement
from .services import MpesaSettlementEngine


class MpesaSettlementEngineTests(TestCase):
    def setUp(self):
        landlord = Landlord.objects.create(
            landlord_id='LL-PAYMENT',
            name='Payment Landlord',
        )
        property_obj = Property.objects.create(
            property_id='PROP-PAYMENT',
            name='Payment Property',
            landlord=landlord,
        )
        unit = Unit.objects.create(
            property=property_obj,
            unit_no='H-01',
            unit_name='House One',
        )
        self.tenant = Tenant.objects.create(
            tenant_id='TNT-PAYMENT',
            name='Payment Tenant',
            phone_number='0712345678',
            unit=unit,
        )
        self.invoice = Invoice.objects.create(
            tenant=self.tenant,
            unit=unit,
            billing_period=date(2026, 11, 1),
            due_date=date(2026, 11, 5),
        )
        InvoiceItem.objects.create(invoice=self.invoice, amount=Decimal('1000.00'))

    def test_credit_bank_payment_matches_smart_alias_and_allocates_invoice(self):
        payment = MpesaSettlementEngine.process_payment({
            'Source': 'credit_bank',
            'TransID': 'CB-TEST-001',
            'TransAmount': '600.00',
            'BusinessShortCode': '6775',
            'BillRefNumber': self.tenant.smart_alias,
            'MSISDN': '254712345678',
        })

        self.invoice.refresh_from_db()
        ledger_transaction = LedgerTransaction.objects.get(
            mpesa_receipt_number='CB-TEST-001'
        )
        self.assertTrue(payment.is_settled)
        self.assertEqual(ledger_transaction.transaction_type, 'credit_bank')
        self.assertEqual(ledger_transaction.account_reference, 'PROP-PAYMENT-H-01')
        self.assertEqual(self.invoice.balance, Decimal('400.00'))
        self.assertEqual(
            PaymentAllocation.objects.filter(
                mpesa_transaction=ledger_transaction
            ).count(),
            1,
        )
        self.assertEqual(PaymentSettlement.objects.filter(transaction=payment).count(), 1)

    def test_duplicate_provider_callback_does_not_allocate_twice(self):
        payload = {
            'Source': 'credit_bank',
            'TransID': 'CB-TEST-002',
            'TransAmount': '600.00',
            'BusinessShortCode': '6775',
            'BillRefNumber': self.tenant.smart_alias,
            'MSISDN': '254712345678',
        }

        MpesaSettlementEngine.process_payment(payload)
        MpesaSettlementEngine.process_payment(payload)

        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.balance, Decimal('400.00'))
        self.assertEqual(PaymentSettlement.objects.count(), 1)

    def test_reused_transaction_reference_with_different_amount_is_rejected(self):
        original = {
            'Source': 'credit_bank',
            'TransID': 'CB-TEST-REUSED',
            'TransAmount': '600.00',
            'BusinessShortCode': '6775',
            'BillRefNumber': self.tenant.smart_alias,
            'MSISDN': '254712345678',
        }
        MpesaSettlementEngine.process_payment(original)
        changed = {**original, 'TransAmount': '700.00'}

        with self.assertRaisesRegex(ValueError, 'different payment details'):
            MpesaSettlementEngine.process_payment(changed)

        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.balance, Decimal('400.00'))

    def test_unknown_alias_is_saved_but_not_marked_settled(self):
        payment = MpesaSettlementEngine.process_payment({
            'Source': 'credit_bank',
            'TransID': 'CB-TEST-003',
            'TransAmount': '600.00',
            'BusinessShortCode': '6775',
            'BillRefNumber': 'UNKNOWN-HOUSE',
            'MSISDN': '254700000000',
        })

        self.assertFalse(payment.is_settled)
        self.assertFalse(LedgerTransaction.objects.get(
            mpesa_receipt_number='CB-TEST-003'
        ).allocations.exists())
