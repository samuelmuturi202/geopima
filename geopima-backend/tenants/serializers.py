from rest_framework import serializers
from .models import Tenant, LeaseAgreement


class TenantSerializer(serializers.ModelSerializer):
    tenant_id = serializers.CharField(required=False, allow_blank=True)
    tenantId = serializers.CharField(source='tenant_id', read_only=True)
    contact = serializers.CharField(source='phone_number', read_only=True)
    property_name = serializers.ReadOnlyField(source='unit.property.name', default=None)
    unit_name = serializers.ReadOnlyField(source='unit.unit_name', default=None)
    landlord_name = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = [
            'id',
            'tenant_id',
            'tenantId',
            'name',
            'email',
            'phone_number',
            'contact',
            'unit',
            'property_name',
            'unit_name',
            'landlord_name',
            'entry_date',
            'due_date',
            'status',
        ]
        read_only_fields = ['id']

    def get_landlord_name(self, obj):
        try:
            if obj.unit and obj.unit.property:
                prop = obj.unit.property
                landlord = getattr(prop, 'landlord', None) or getattr(prop, 'owner', None)
                if landlord:
                    return str(landlord)
        except AttributeError:
            pass
        return None


class LeaseAgreementSerializer(serializers.ModelSerializer):
    tenant_name = serializers.ReadOnlyField(source='tenant.name', default=None)
    unit_number = serializers.ReadOnlyField(source='unit.unit_name', default=None)
    property_name = serializers.ReadOnlyField(source='unit.property.name', default=None)

    class Meta:
        model = LeaseAgreement
        fields = [
            'id',
            'tenant',
            'tenant_name',
            'unit',
            'unit_number',
            'property_name',
            'start_date',
            'end_date',
            'rent_amount',
            'deposit_amount',
            'is_active',
            'agreement_file',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']