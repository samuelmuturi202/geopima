from datetime import timedelta
from tempfile import TemporaryDirectory

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from .views import PropertyAgreementViewSet
from .models import Landlord, Property, PropertyAgreement, Unit
from .serializers import PropertySerializer


class PropertySerializerIntegrityTests(TestCase):
    def test_partial_update_preserves_property_id(self):
        landlord = Landlord.objects.create(
            landlord_id='LL-PROPERTY-UPDATE',
            name='Property Update Landlord',
        )
        property_obj = Property.objects.create(
            property_id='PROP-STABLE',
            name='Stable Property',
            landlord=landlord,
        )
        serializer = PropertySerializer(
            property_obj,
            data={'name': 'Renamed Property'},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        property_obj.refresh_from_db()
        self.assertEqual(property_obj.property_id, 'PROP-STABLE')
        self.assertEqual(property_obj.name, 'Renamed Property')


class UnitPaginationApiTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_superuser(
            username='unit-pagination-admin',
            email='unit-pagination@example.com',
            password='test-pass',
        )
        self.client = APIClient()
        self.client.force_authenticate(user)
        self.landlord = Landlord.objects.create(
            landlord_id='LL-UNIT-PAGINATION',
            name='Unit Pagination Landlord',
        )
        property_obj = Property.objects.create(
            property_id='PROP-UNIT-PAGINATION',
            name='Unit Pagination Property',
            landlord=self.landlord,
        )
        Unit.objects.bulk_create([
            Unit(property=property_obj, unit_no=f'UNIT-{index}', unit_name=f'Unit {index}')
            for index in range(1, 4)
        ])

    def test_unit_list_honors_selected_page_size(self):
        first_page = self.client.get('/api/v1/properties/units/?page_size=2')
        second_page = self.client.get('/api/v1/properties/units/?page_size=2&page=2')

        self.assertEqual(first_page.status_code, 200)
        self.assertEqual(first_page.data['count'], 3)
        self.assertEqual(len(first_page.data['results']), 2)
        self.assertIsNotNone(first_page.data['next'])
        self.assertEqual(first_page.data['results'][0]['property_id'], 'PROP-UNIT-PAGINATION')
        self.assertEqual(first_page.data['results'][0]['landlord_id'], self.landlord.pk)
        self.assertEqual(second_page.status_code, 200)
        self.assertEqual(len(second_page.data['results']), 1)

    def test_page_size_is_capped_at_one_hundred(self):
        response = self.client.get('/api/v1/properties/units/?page_size=500')

        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(len(response.data['results']), 100)

    def test_unit_tenants_endpoint_returns_related_tenants(self):
        from tenants.models import Tenant

        unit = Unit.objects.first()
        tenant = Tenant.objects.create(
            tenant_id='TNT-UNIT-HISTORY',
            name='Unit History Tenant',
            phone_number='0712345678',
            unit=unit,
        )

        response = self.client.get(f'/api/v1/properties/units/{unit.pk}/tenants/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['tenant_id'], tenant.tenant_id)
        self.assertEqual(response.data[0]['unit_id'], unit.pk)


class PropertyAgreementApiTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_superuser(
            username='property-agreement-admin',
            email='property-agreement@example.com',
            password='test-pass',
        )
        self.user = user
        self.client = APIClient()
        self.client.force_authenticate(user)
        landlord = Landlord.objects.create(
            landlord_id='LL-AGREEMENT',
            name='Property Agreement Landlord',
        )
        self.property = Property.objects.create(
            property_id='PROP-AGREEMENT',
            name='Property Agreement Property',
            landlord=landlord,
        )
        self.media_dir = TemporaryDirectory()
        self.addCleanup(self.media_dir.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.media_dir.name)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)

    def test_agreements_can_be_uploaded_listed_updated_and_deleted(self):
        today = timezone.localdate()
        response = self.client.post(
            '/api/v1/properties/property-agreements/',
            {
                'property': self.property.pk,
                'description': 'Management agreement',
                'start_date': today.isoformat(),
                'end_date': (today + timedelta(days=365)).isoformat(),
                'agreement_file': SimpleUploadedFile(
                    'management-agreement.pdf',
                    b'%PDF-1.4 test agreement',
                    content_type='application/pdf',
                ),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 201)
        agreement_id = response.data['id']
        self.assertEqual(response.data['status'], 'Active')
        self.assertIn('/file/', response.data['file_url'])
        self.assertEqual(response.data['file_name'], 'management-agreement.pdf')
        self.assertEqual(
            self.client.get(
                f'/api/v1/properties/property-agreements/?property={self.property.pk}'
            ).data['count'],
            1,
        )
        update_response = self.client.patch(
            f'/api/v1/properties/property-agreements/{agreement_id}/',
            {'description': 'Updated management agreement'},
            format='multipart',
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.data['description'], 'Updated management agreement')

        delete_response = self.client.delete(
            f'/api/v1/properties/property-agreements/{agreement_id}/'
        )
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(PropertyAgreement.objects.filter(pk=agreement_id).exists())

    def test_agreement_rejects_reversed_dates(self):
        today = timezone.localdate()
        response = self.client.post(
            '/api/v1/properties/property-agreements/',
            {
                'property': self.property.pk,
                'description': 'Invalid agreement',
                'start_date': (today + timedelta(days=1)).isoformat(),
                'end_date': today.isoformat(),
                'agreement_file': SimpleUploadedFile('agreement.pdf', b'valid extension'),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('end_date', response.data)
        self.assertFalse(PropertyAgreement.objects.exists())

    def test_agreement_rejects_unsupported_files(self):
        today = timezone.localdate()
        response = self.client.post(
            '/api/v1/properties/property-agreements/',
            {
                'property': self.property.pk,
                'description': 'Invalid file',
                'start_date': today.isoformat(),
                'end_date': (today + timedelta(days=365)).isoformat(),
                'agreement_file': SimpleUploadedFile('agreement.exe', b'not allowed'),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('agreement_file', response.data)
        self.assertFalse(PropertyAgreement.objects.exists())

    def test_agreement_file_download_returns_attachment(self):
        today = timezone.localdate()
        create_response = self.client.post(
            '/api/v1/properties/property-agreements/',
            {
                'property': self.property.pk,
                'description': 'Download test agreement',
                'start_date': today.isoformat(),
                'end_date': (today + timedelta(days=365)).isoformat(),
                'agreement_file': SimpleUploadedFile(
                    'download-test.pdf',
                    b'%PDF-1.4 test agreement',
                    content_type='application/pdf',
                ),
            },
            format='multipart',
        )
        self.assertEqual(create_response.status_code, 201)

        request = APIRequestFactory().get(create_response.data['file_url'])
        force_authenticate(request, self.user)
        download_view = PropertyAgreementViewSet.as_view({'get': 'download_file'}, detail=True)
        response = download_view(request, pk=create_response.data['id'])
        downloaded_file = response.file_to_stream
        try:
            self.assertEqual(response.status_code, 200)
            self.assertIn('attachment', response['Content-Disposition'])
            self.assertIn('download-test.pdf', response['Content-Disposition'])
            self.assertEqual(b''.join(response.streaming_content), b'%PDF-1.4 test agreement')
        finally:
            downloaded_file.close()
