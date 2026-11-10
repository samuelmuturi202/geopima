from django.test import TestCase

from .models import Landlord, Property
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
