from django.db import IntegrityError, transaction
from django.test import TestCase

from properties.models import Landlord, Property, Unit
from .serializers import TenantSerializer

from .models import Tenant


class TenantSmartAliasTests(TestCase):
    def setUp(self):
        landlord = Landlord.objects.create(
            landlord_id='LL-ALIAS',
            name='Alias Landlord',
        )
        self.property = Property.objects.create(
            property_id=' prop-alias ',
            name='Alias Property',
            landlord=landlord,
        )
        self.unit = Unit.objects.create(
            property=self.property,
            unit_no=' h-01 ',
            unit_name='House One',
        )

    def test_smart_alias_uses_property_number_and_house_number(self):
        tenant = Tenant.objects.create(
            tenant_id='TNT-ALIAS',
            name='Alias Tenant',
            phone_number='0712345678',
            unit=self.unit,
        )

        self.assertEqual(tenant.smart_alias, 'PROP-ALIAS-H-01')
        self.assertEqual(self.property.property_id, 'PROP-ALIAS')
        self.assertEqual(self.unit.unit_no, 'H-01')

    def test_alias_updates_when_house_or_property_number_changes(self):
        tenant = Tenant.objects.create(
            tenant_id='TNT-ALIAS',
            name='Alias Tenant',
            phone_number='0712345678',
            unit=self.unit,
        )

        self.unit.unit_no = 'H-02'
        self.unit.save(update_fields=['unit_no'])
        tenant.refresh_from_db()
        self.assertEqual(tenant.smart_alias, 'PROP-ALIAS-H-02')

        self.property.property_id = 'PROP-NEW'
        self.property.save(update_fields=['property_id'])
        tenant.refresh_from_db()
        self.assertEqual(tenant.smart_alias, 'PROP-NEW-H-02')

    def test_alias_is_cleared_when_tenant_has_no_unit(self):
        tenant = Tenant.objects.create(
            tenant_id='TNT-ALIAS',
            name='Alias Tenant',
            phone_number='0712345678',
            unit=self.unit,
        )

        tenant.unit = None
        tenant.save(update_fields=['unit'])

        self.assertEqual(tenant.smart_alias, '')

    def test_database_updates_keep_aliases_canonical(self):
        tenant = Tenant.objects.create(
            tenant_id='TNT-ALIAS',
            name='Alias Tenant',
            phone_number='0712345678',
            unit=self.unit,
        )

        Unit.objects.filter(pk=self.unit.pk).update(unit_no=' h-03 ')
        tenant.refresh_from_db()
        self.assertEqual(tenant.smart_alias, 'PROP-ALIAS-H-03')

        Property.objects.filter(pk=self.property.pk).update(property_id=' prop-db ')
        tenant.refresh_from_db()
        self.assertEqual(tenant.smart_alias, 'PROP-DB-H-03')

        Tenant.objects.filter(pk=tenant.pk).update(smart_alias='forged-alias')
        tenant.refresh_from_db()
        self.assertEqual(tenant.smart_alias, 'PROP-DB-H-03')

    def test_unit_alias_components_are_unique_per_property(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Unit.objects.create(
                    property=self.property,
                    unit_no='h-01',
                    unit_name='Duplicate House',
                )

    def test_tenant_api_exposes_the_primary_key_and_read_only_alias(self):
        tenant = Tenant.objects.create(
            tenant_id='TNT-ALIAS',
            name='Alias Tenant',
            phone_number='0712345678',
            unit=self.unit,
        )

        serializer = TenantSerializer(tenant)
        self.assertEqual(serializer.data['id'], 'TNT-ALIAS')
        self.assertEqual(serializer.data['smart_alias'], 'PROP-ALIAS-H-01')
        self.assertIn('smart_alias', serializer.fields)
        self.assertFalse(serializer.fields['smart_alias'].writable)
