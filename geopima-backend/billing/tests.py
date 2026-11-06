from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from billing.communication import generate_communication_drafts
from billing.models import CommunicationDraft, Invoice, InvoiceItem
from config_core.models import MessengerConfig, SMSTemplate
from config_core.sms_gateway import (
    SMSDelivery,
    SMSDeliveryUncertain,
    SMSGatewayConfigurationError,
    send_sms,
)
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
        self.assertEqual(second_run['updated'], 0)
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

        self.assertEqual(result, {'created': 0, 'updated': 0, 'skipped_no_phone': 1})
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

    def test_saved_templates_are_used_for_tenant_and_landlord_drafts(self):
        run_date = date(2026, 11, 1)
        invoice = self.create_invoice(date(2026, 10, 5), date(2026, 10, 1))
        payment = MpesaTransaction.objects.create(
            mpesa_receipt_number='TEST789',
            amount=Decimal('250.00'),
            phone_number=self.tenant.phone_number,
        )
        PaymentAllocation.objects.create(
            invoice=invoice,
            mpesa_transaction=payment,
            amount_allocated=Decimal('250.00'),
        )
        SMSTemplate.objects.create(
            category='FEE_REMINDER',
            template_text='Tenant {tenant}: balance {balance}, due {due_date}.',
        )
        SMSTemplate.objects.create(
            category='LANDLORD_UPDATE',
            template_text=(
                '{landlord} {month}: {expected}/{collected}/{outstanding} ({agency})'
            ),
        )

        generate_communication_drafts(
            run_date=run_date,
            include_landlord_summaries=True,
        )

        tenant_draft = CommunicationDraft.objects.get(reminder_type='rent_overdue')
        landlord_draft = CommunicationDraft.objects.get(reminder_type='landlord_monthly')
        self.assertIn('Tenant Test Tenant: balance 750.00', tenant_draft.message)
        self.assertIn('due 05 Oct 2026', tenant_draft.message)
        self.assertIn('Amina Landlord October 2026', landlord_draft.message)
        self.assertIn('1,000.00/250.00/750.00', landlord_draft.message)

    def test_regeneration_updates_pending_drafts_to_saved_template(self):
        run_date = date(2026, 11, 5)
        invoice = self.create_invoice(
            run_date + timedelta(days=5), date(2026, 11, 1)
        )
        generate_communication_drafts(run_date=run_date)
        SMSTemplate.objects.create(
            category='FEE_REMINDER',
            template_text='Updated {tenant} balance: {balance}.',
        )

        result = generate_communication_drafts(run_date=run_date)

        draft = CommunicationDraft.objects.get(invoice=invoice)
        self.assertEqual(result['created'], 0)
        self.assertEqual(result['updated'], 1)
        self.assertEqual(draft.message, 'Updated Test Tenant balance: 1,000.00. This rent is due soon. Please pay by 10 Nov 2026.')


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

    def test_only_approved_drafts_can_be_sent(self):
        response = self.client.post(
            f'/api/v1/billing/communication-drafts/{self.draft.pk}/send/'
        )

        self.assertEqual(response.status_code, 409)
        self.draft.refresh_from_db()
        self.assertEqual(self.draft.status, 'pending')

    @patch('billing.views.send_sms', return_value=SMSDelivery(message_id='celcom-123'))
    def test_approved_draft_sends_and_persists_provider_receipt(self, mocked_send):
        self.draft.status = 'approved'
        self.draft.save(update_fields=['status', 'updated_at'])
        MessengerConfig.objects.create(
            id=1,
            service_provider='Celcom Africa',
            sender_id='GEOPIMA',
            partner_id='partner',
            partner_key='secret',
        )

        response = self.client.post(
            f'/api/v1/billing/communication-drafts/{self.draft.pk}/send/'
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'sent')
        self.assertEqual(response.data['provider_message_id'], 'celcom-123')
        mocked_send.assert_called_once()
        self.draft.refresh_from_db()
        self.assertEqual(self.draft.status, 'sent')
        self.assertIsNotNone(self.draft.sent_at)

    @patch(
        'billing.views.send_sms',
        side_effect=SMSDeliveryUncertain('Provider response timed out.'),
    )
    def test_uncertain_delivery_is_not_retryable(self, mocked_send):
        self.draft.status = 'approved'
        self.draft.save(update_fields=['status', 'updated_at'])
        MessengerConfig.objects.create(
            id=1,
            service_provider='Celcom Africa',
            sender_id='GEOPIMA',
            partner_id='partner',
            partner_key='secret',
        )

        response = self.client.post(
            f'/api/v1/billing/communication-drafts/{self.draft.pk}/send/'
        )

        self.assertEqual(response.status_code, 502)
        self.draft.refresh_from_db()
        self.assertEqual(self.draft.status, 'unknown')
        retry_response = self.client.post(
            f'/api/v1/billing/communication-drafts/{self.draft.pk}/send/'
        )
        self.assertEqual(retry_response.status_code, 409)
        mocked_send.assert_called_once()


class CelcomGatewayTests(TestCase):
    def setUp(self):
        self.config = MessengerConfig(
            service_provider='Celcom Africa',
            sender_id='GEOPIMA',
            partner_id='partner',
            partner_key='secret',
        )

    @patch('config_core.sms_gateway.requests.post')
    def test_sends_normalized_phone_and_parses_success(self, mocked_post):
        mocked_post.return_value.ok = True
        mocked_post.return_value.status_code = 200
        mocked_post.return_value.json.return_value = {
            'responses': [{'response-code': 200, 'messageid': 'celcom-123'}]
        }

        delivery = send_sms(self.config, '0712345678', 'Test message')

        self.assertEqual(delivery.message_id, 'celcom-123')
        _, request = mocked_post.call_args
        self.assertEqual(request['json']['mobile'], '254712345678')
        self.assertEqual(request['json']['apikey'], 'secret')
        self.assertEqual(request['json']['partnerID'], 'partner')
        self.assertEqual(request['json']['shortcode'], 'GEOPIMA')
        self.assertEqual(request['timeout'], (5, 20))

    def test_rejects_missing_credentials_without_sending(self):
        self.config.partner_key = ''

        with patch('config_core.sms_gateway.requests.post') as mocked_post:
            with self.assertRaises(SMSGatewayConfigurationError):
                send_sms(self.config, '0712345678', 'Test message')

        mocked_post.assert_not_called()

    @patch('config_core.sms_gateway.requests.post')
    def test_unrecognized_provider_response_is_uncertain(self, mocked_post):
        mocked_post.return_value.ok = True
        mocked_post.return_value.status_code = 200
        mocked_post.return_value.json.return_value = {'message': 'accepted'}

        with self.assertRaises(SMSDeliveryUncertain):
            send_sms(self.config, '0712345678', 'Test message')
