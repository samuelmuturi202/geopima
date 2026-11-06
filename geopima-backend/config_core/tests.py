from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import MessengerConfig, SMSTemplate


class SMSTemplateApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_superuser(
            username='template-admin',
            email='template-admin@example.com',
            password='test-pass',
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_templates_list_returns_plain_list_for_configuration_page(self):
        SMSTemplate.objects.create(
            category='FEE_REMINDER',
            template_text='Hello {tenant}',
        )

        response = self.client.get('/api/v1/sms-templates/')

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
        self.assertEqual(response.data[0]['category'], 'FEE_REMINDER')

    def test_bulk_save_creates_landlord_update_template(self):
        response = self.client.post(
            '/api/v1/sms-templates/bulk-save/',
            [{
                'category': 'LANDLORD_UPDATE',
                'template_text': 'Hello {landlord}: {collected}',
            }],
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            SMSTemplate.objects.get(category='LANDLORD_UPDATE').template_text,
            'Hello {landlord}: {collected}',
        )

    def test_bulk_save_rejects_empty_template_without_saving_partial_data(self):
        response = self.client.post(
            '/api/v1/sms-templates/bulk-save/',
            [
                {'category': 'FEE_REMINDER', 'template_text': 'Valid text'},
                {'category': 'LANDLORD_UPDATE', 'template_text': '  '},
            ],
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(SMSTemplate.objects.exists())

    def test_default_messenger_configuration_uses_neutral_gateway_name(self):
        config, _ = MessengerConfig.objects.get_or_create(id=1)

        self.assertEqual(config.service_provider, 'Celcom Africa')

    def test_admin_can_edit_and_save_sms_gateway_name(self):
        response = self.client.put(
            '/api/v1/messenger-configs/1/',
            {
                'service_provider': 'Acme SMS',
                'sender_id': 'GEOPIMA',
                'partner_id': '',
                'partner_key': '',
                'agency_phone': '',
                'notify_tenant': True,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['service_provider'], 'Acme SMS')
        self.assertEqual(
            MessengerConfig.objects.get(pk=1).service_provider,
            'Acme SMS',
        )
