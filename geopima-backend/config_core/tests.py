from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import (
    CreditBankConfig,
    MessengerConfig,
    PaymentBank,
    SMSTemplate,
    UserProfile,
    UserRole,
)
from .serializers import (
    CreditBankConfigSerializer,
    PaymentBankSerializer,
    UserAccountSerializer,
)


class SMSTemplateApiTests(TestCase):
    def setUp(self):
        SMSTemplate.objects.all().delete()
        MessengerConfig.objects.all().delete()
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

    def test_credit_bank_paybill_defaults_to_6775(self):
        config = CreditBankConfig.objects.create(id=1)

        self.assertEqual(config.paybill_number, '6775')

    def test_credit_bank_configuration_read_does_not_reset_saved_paybill(self):
        CreditBankConfig.objects.create(
            id=1,
            paybill_number='6775',
            client_id='',
        )

        response = self.client.get('/api/v1/credit-bank-configs/1/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['paybill_number'], '6775')

    def test_credit_bank_paybill_updates_the_invoice_payment_channel(self):
        config = CreditBankConfig.objects.create(id=1, paybill_number='6775')
        channel = PaymentBank.objects.create(
            short_name='Credit Bank',
            long_name='Credit Bank Smart Alias',
            acc_name='Tenant Payments',
            business_no='6775',
            acc_number='Tenant Smart Alias',
            bank_type='smart_alias',
            is_active=True,
            on_invoice=True,
        )
        serializer = CreditBankConfigSerializer(
            config,
            data={'paybill_number': '6999'},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        channel.refresh_from_db()
        self.assertEqual(channel.business_no, '6999')

    def test_smart_alias_channel_cannot_diverge_from_credit_bank_paybill(self):
        CreditBankConfig.objects.create(id=1, paybill_number='6775')
        serializer = PaymentBankSerializer(data={
            'short_name': 'Credit Bank',
            'long_name': 'Credit Bank Smart Alias',
            'acc_name': 'Tenant Payments',
            'business_no': '6999',
            'acc_number': 'Tenant Smart Alias',
            'bank_type': 'smart_alias',
            'is_active': True,
            'on_invoice': True,
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn('business_no', serializer.errors)


class RolePermissionApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.role = UserRole.objects.create(
            name='Property Reader',
            permissions=['property_access'],
        )
        self.user = user_model.objects.create_user(
            username='role-reader',
            email='role-reader@example.com',
            password='test-pass',
        )
        self.user.profile.role = self.role
        self.user.profile.save()
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_unauthenticated_requests_are_denied(self):
        response = APIClient().get('/api/v1/properties/')

        self.assertEqual(response.status_code, 401)

    def test_access_permission_allows_reads_but_not_writes(self):
        read_response = self.client.get('/api/v1/properties/')
        write_response = self.client.post('/api/v1/properties/', {}, format='json')

        self.assertEqual(read_response.status_code, 200)
        self.assertEqual(write_response.status_code, 403)

    def test_permission_changes_take_effect_without_reauthenticating(self):
        self.role.permissions = []
        self.role.save(update_fields=['permissions'])
        denied_response = self.client.get('/api/v1/properties/')

        self.role.permissions = ['property_access']
        self.role.save(update_fields=['permissions'])
        allowed_response = self.client.get('/api/v1/properties/')

        self.assertEqual(denied_response.status_code, 403)
        self.assertEqual(allowed_response.status_code, 200)

    def test_role_name_does_not_grant_permissions(self):
        self.role.name = 'admin'
        self.role.permissions = []
        self.role.save(update_fields=['name', 'permissions'])

        response = self.client.get('/api/v1/properties/')

        self.assertEqual(response.status_code, 403)

    def test_user_without_an_assigned_role_is_denied(self):
        self.user.profile.role = None
        self.user.profile.save(update_fields=['role'])

        response = self.client.get('/api/v1/properties/')

        self.assertEqual(response.status_code, 403)

    def test_superuser_bypasses_the_role_matrix(self):
        self.user.is_superuser = True
        self.user.save(update_fields=['is_superuser'])
        self.role.permissions = []
        self.role.save(update_fields=['permissions'])

        response = self.client.get('/api/v1/properties/')

        self.assertEqual(response.status_code, 200)

    def test_invoice_payment_uses_payment_create_permission(self):
        self.role.permissions = ['payment_create']
        self.role.save(update_fields=['permissions'])

        list_response = self.client.get('/api/v1/billing/invoices/')
        response = self.client.post(
            '/api/v1/billing/invoices/1/add-payment/',
            {},
            format='json',
        )

        self.assertEqual(list_response.status_code, 403)
        self.assertNotEqual(response.status_code, 403)
        self.assertIn(response.status_code, [400, 404])

    def test_updating_role_keeps_profile_and_many_to_many_assignments_in_sync(self):
        other_role = UserRole.objects.create(
            name='Property Editor',
            permissions=['property_create'],
        )
        self.user.roles.set([other_role])
        serializer = UserAccountSerializer(
            self.user,
            data={'role_id': other_role.pk},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_user = serializer.save()

        self.assertEqual(
            UserProfile.objects.get(user=updated_user).role_id,
            other_role.pk,
        )
        self.assertEqual(
            list(updated_user.roles.values_list('id', flat=True)),
            [other_role.pk],
        )

    def test_clearing_role_removes_all_role_permissions(self):
        self.user.roles.set([self.role])
        serializer = UserAccountSerializer(
            self.user,
            data={'role_id': None},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_user = serializer.save()

        self.assertIsNone(UserProfile.objects.get(user=updated_user).role_id)
        self.assertFalse(updated_user.roles.exists())

    def test_user_update_cannot_grant_superuser_status(self):
        serializer = UserAccountSerializer(
            self.user,
            data={'is_superuser': True},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_user = serializer.save()

        self.assertFalse(updated_user.is_superuser)

    def test_mpesa_validation_callback_remains_public(self):
        response = APIClient().post(
            '/api/v1/mpesa/c2b/validation/',
            {'TransID': 'TEST'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)

    def test_mpesa_reprocessing_requires_payment_update(self):
        self.role.permissions = ['payment_create']
        self.role.save(update_fields=['permissions'])
        denied_response = self.client.post(
            '/api/v1/mpesa/paybill-transactions/verify-batch/',
            {},
            format='json',
        )

        self.role.permissions = ['payment_update']
        self.role.save(update_fields=['permissions'])
        allowed_response = self.client.post(
            '/api/v1/mpesa/paybill-transactions/verify-batch/',
            {},
            format='json',
        )

        self.assertEqual(denied_response.status_code, 403)
        self.assertEqual(allowed_response.status_code, 200)
