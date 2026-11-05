from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from billing.communication import generate_communication_drafts
from billing.models import CommunicationDraft, Invoice, InvoiceItem
from properties.models import Landlord, MpesaTransaction, PaymentAllocation, Property, Unit
from tenants.models import Tenant


class CommunicationDraftGenerationTests(TestCase):
    def setUp(self):
        self.landlord = Landlord.objects.create(
            landlord_id='LL-TEST',
            name='Amina Landlord',
            phone_number='0712345678',
        )
        self.property = Property.objects.create(
            property_id='PROP-TEST',
            name='Green Court',
            landlord=self.landlord,
        )
        self.unit = Unit.objects.create(
            unit_no='1',
            unit_name='A1',
            property=self.property,
            is_occupied=True,
        )
        self.tenant = Tenant.objects.create(
            tenant_id='TNT-TEST',
            name='Test Tenant',
            phone_number='0722222222',
            unit=self.unit,
        )

    def create_invoice(self, due_date, billing_period, amount='1000.00'):
        invoice = Invoice.objects.create(
            tenant=self.tenant,
            unit=self.unit,
            billing_period=billing_period,
            due_date=due_date,
        )
        InvoiceItem.objects.create(invoice=invoice, amount=Decimal(amount))
        return invoice

    def test_creates_pre_due_and_overdue_drafts_once(self):
        run_date = date(2026, 11, 5)
        upcoming = self.create_invoice(
            run_date + timedelta(days=5), date(2026, 11, 1)
        )
        overdue = self.create_invoice(
            run_date - timedelta(days=2), date(2026, 10, 1)
        )
        payment = MpesaTransaction.objects.create(
            mpesa_receipt_number='TEST123',
            amount=Decimal('300.00'),
            phone_number=self.tenant.phone_number,
        )
        PaymentAllocation.objects.create(
            invoice=overdue,
            mpesa_transaction=payment,
            amount_allocated=Decimal('300.00'),
        )

        first_run = generate_communication_drafts(run_date=run_date)
        second_run = generate_communication_drafts(run_date=run_date)

        self.assertEqual(first_run['created'], 2)
        self.assertEqual(second_run['created'], 0)
        self.assertEqual(
            CommunicationDraft.objects.get(invoice=upcoming).reminder_type,
            'rent_due',
        )
        overdue_draft = CommunicationDraft.objects.get(invoice=overdue)
        self.assertEqual(overdue_draft.reminder_type, 'rent_overdue')
        self.assertIn('700.00', overdue_draft.message)

    def test_skips_tenants_without_phone_number(self):
        self.tenant.phone_number = ''
        self.tenant.save(update_fields=['phone_number'])
        self.create_invoice(date(2026, 11, 10), date(2026, 11, 1))

        result = generate_communication_drafts(run_date=date(2026, 11, 5))

        self.assertEqual(result, {'created': 0, 'skipped_no_phone': 1})
        self.assertFalse(CommunicationDraft.objects.exists())

    def test_creates_previous_month_landlord_summary_on_first(self):
        run_date = date(2026, 11, 1)
        invoice = self.create_invoice(date(2026, 10, 5), date(2026, 10, 1))
        transaction = MpesaTransaction.objects.create(
            mpesa_receipt_number='TEST456',
            amount=Decimal('250.00'),
            phone_number=self.tenant.phone_number,
        )
        PaymentAllocation.objects.create(
            invoice=invoice,
            mpesa_transaction=transaction,
            amount_allocated=Decimal('250.00'),
        )

        result = generate_communication_drafts(run_date=run_date)

        draft = CommunicationDraft.objects.get(reminder_type='landlord_monthly')
        self.assertEqual(result['created'], 2)
        self.assertEqual(draft.period, date(2026, 10, 1))
        self.assertIn('KES 250.00 collected', draft.message)
        self.assertIn('KES 750.00 outstanding', draft.message)


class CommunicationDraftApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username='staff', password='test-pass')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.draft = CommunicationDraft.objects.create(
            recipient_type='tenant',
            recipient_name='Test Tenant',
            phone_number='0722222222',
            reminder_type='rent_overdue',
            message='Please review this rent reminder.',
        )

    def test_staff_can_approve_a_draft_without_sending(self):
        response = self.client.post(
            f'/api/v1/billing/communication-drafts/{self.draft.pk}/approve/'
        )

        self.assertEqual(response.status_code, 200)
        self.draft.refresh_from_db()
        self.assertEqual(self.draft.status, 'approved')
        self.assertEqual(response.data['status'], 'approved')
