import uuid
from rest_framework import serializers
from .models import Landlord, Property, Unit


class LandlordSerializer(serializers.ModelSerializer):
    class Meta:
        model = Landlord
        fields = '__all__'

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)

        if 'gender' in data and data['gender']:
            val = str(data['gender']).strip().upper()
            if val.startswith('F'):
                data['gender'] = 'FEMALE'
            elif val.startswith('M'):
                data['gender'] = 'MALE'
            else:
                data['gender'] = 'OTHER'

        return super().to_internal_value(data)

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class PropertySerializer(serializers.ModelSerializer):
    landlord_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    landlord = serializers.PrimaryKeyRelatedField(
        queryset=Landlord.objects.all(), 
        required=False, 
        allow_null=True
    )
    
    total_units = serializers.IntegerField(source='units.count', read_only=True)
    occupied_units = serializers.SerializerMethodField(read_only=True)
    status = serializers.SerializerMethodField(read_only=True)
    is_active = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Property
        fields = [
            'id', 
            'property_id',
            'name', 
            'landlord', 
            'landlord_name', 
            'description',
            'location', 
            'cluster',
            'commission_percentage',
            'default_deposit',
            'default_security_fee',
            'default_electricity_fee',
            'default_internet_fee',
            'default_garbage_fee',
            'default_water_rate',
            'total_units', 
            'occupied_units', 
            'status',
            'is_active',
        ]
        extra_kwargs = {
            'property_id': {'required': False, 'allow_null': True, 'allow_blank': True},
            'description': {'required': False, 'allow_null': True, 'allow_blank': True},
            'location': {'required': False, 'allow_null': True, 'allow_blank': True},
            'cluster': {'required': False, 'allow_null': True, 'allow_blank': True},
            'commission_percentage': {'required': False, 'allow_null': True},
            'default_deposit': {'required': False, 'allow_null': True},
            'default_security_fee': {'required': False, 'allow_null': True},
            'default_electricity_fee': {'required': False, 'allow_null': True},
            'default_internet_fee': {'required': False, 'allow_null': True},
            'default_garbage_fee': {'required': False, 'allow_null': True},
            'default_water_rate': {'required': False, 'allow_null': True},
        }

    def _generate_property_id(self):
        return f"PROP-{uuid.uuid4().hex[:6].upper()}"

    def _get_or_create_landlord(self, name_str):
        name_clean = str(name_str).strip() if name_str else "Default Landlord"
        if not name_clean:
            name_clean = "Default Landlord"

        landlord = Landlord.objects.filter(name__iexact=name_clean).first()
        if not landlord and hasattr(Landlord, 'full_name'):
            landlord = Landlord.objects.filter(full_name__iexact=name_clean).first()

        if landlord:
            return landlord

        lookup_kwargs = {}
        if hasattr(Landlord, 'name'):
            lookup_kwargs['name'] = name_clean
        elif hasattr(Landlord, 'full_name'):
            lookup_kwargs['full_name'] = name_clean
        elif hasattr(Landlord, 'first_name'):
            parts = name_clean.split(' ', 1)
            lookup_kwargs['first_name'] = parts[0]
            lookup_kwargs['last_name'] = parts[1] if len(parts) > 1 else '-'

        defaults = {
            'landlord_id': f"LND-{uuid.uuid4().hex[:6].upper()}"
        }

        if hasattr(Landlord, 'phone_number'):
            defaults['phone_number'] = f"0700{uuid.uuid4().hex[:5]}"
        if hasattr(Landlord, 'phone'):
            defaults['phone'] = f"0700{uuid.uuid4().hex[:5]}"
        if hasattr(Landlord, 'email'):
            defaults['email'] = f"landlord_{uuid.uuid4().hex[:4]}@geopima.local"

        landlord, _ = Landlord.objects.get_or_create(
            **lookup_kwargs,
            defaults=defaults
        )
        return landlord

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)

        raw_prop_id = data.get('property_id') or data.get('propertyId') or data.get('pro_id')
        if not raw_prop_id or not str(raw_prop_id).strip():
            data['property_id'] = self._generate_property_id()
        else:
            data['property_id'] = str(raw_prop_id).strip()

        raw_name = data.get('name') or data.get('propertyName') or data.get('property_name')
        if raw_name:
            data['name'] = str(raw_name).strip()

        raw_landlord = (
            data.get('landlord_name') or 
            data.get('landlordName') or 
            data.get('landlord')
        )
        if raw_landlord:
            val_str = str(raw_landlord).strip()
            if val_str.isdigit():
                data['landlord'] = int(val_str)
            else:
                landlord_obj = self._get_or_create_landlord(val_str)
                data['landlord'] = landlord_obj.pk

        raw_location = data.get('location') or data.get('locationName') or data.get('location_name')
        if raw_location is not None:
            data['location'] = str(raw_location).strip()

        raw_cluster = data.get('cluster') or data.get('clusterName')
        if raw_cluster is not None:
            data['cluster'] = str(raw_cluster).strip()

        raw_comm = data.get('commission_percentage') or data.get('commission') or data.get('commissionRate')
        if raw_comm is not None and str(raw_comm).strip() != '':
            data['commission_percentage'] = raw_comm

        return super().to_internal_value(data)

    def create(self, validated_data):
        validated_data.pop('landlord_name', None)

        if not validated_data.get('property_id'):
            validated_data['property_id'] = self._generate_property_id()

        if 'landlord' not in validated_data or not validated_data['landlord']:
            validated_data['landlord'] = self._get_or_create_landlord("Default Landlord")

        return super().create(validated_data)

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        
        if instance.landlord:
            landlord_val = getattr(
                instance.landlord, 'name', getattr(instance.landlord, 'full_name', '-')
            )
        else:
            landlord_val = '-'

        representation['landlord_name'] = landlord_val
        representation['landlordName'] = landlord_val
        representation['propertyId'] = instance.property_id
        representation['propertyName'] = instance.name
        representation['commissionRate'] = getattr(instance, 'commission_percentage', 0)
        
        representation['default_deposit'] = getattr(instance, 'default_deposit', 0)
        representation['default_security_fee'] = getattr(instance, 'default_security_fee', 0)
        representation['default_electricity_fee'] = getattr(instance, 'default_electricity_fee', 0)
        representation['default_internet_fee'] = getattr(instance, 'default_internet_fee', 0)
        representation['default_garbage_fee'] = getattr(instance, 'default_garbage_fee', 0)
        representation['default_water_rate'] = getattr(instance, 'default_water_rate', 0)

        tot_units = instance.units.count() if hasattr(instance, 'units') else 0
        occ_units = self.get_occupied_units(instance)
        representation['occUnits'] = f"{occ_units}/{tot_units}"
        representation['occupied_units'] = occ_units
        representation['total_units'] = tot_units

        return representation

    def get_occupied_units(self, obj):
        if hasattr(obj, 'units'):
            return obj.units.filter(is_occupied=True).count()
        return 0

    def get_status(self, obj):
        if hasattr(obj, 'status') and obj.status:
            return obj.status
        return 'Active' if getattr(obj, 'is_active', True) else 'Inactive'

    def get_is_active(self, obj):
        current_status = str(self.get_status(obj)).lower()
        return current_status in ['active', 'occupied', 'available']


class UnitSerializer(serializers.ModelSerializer):
    property_name = serializers.ReadOnlyField(source='property.name', default='')
    
    # Expect and process string property_id values as primary lookup reference
    property = serializers.SlugRelatedField(
        queryset=Property.objects.all(),
        slug_field='property_id',
        required=False,
        allow_null=True
    )

    landlord_name = serializers.SerializerMethodField(read_only=True)
    tenant_name = serializers.SerializerMethodField(read_only=True)
    
    unitNo = serializers.CharField(source='unit_no', required=False, allow_blank=True)
    unitName = serializers.CharField(source='unit_name', required=False, allow_blank=True)
    unitType = serializers.CharField(source='unit_type', required=False, allow_blank=True, allow_null=True)
    unitCategory = serializers.CharField(source='category', required=False, allow_blank=True, allow_null=True)
    
    vacancy = serializers.SerializerMethodField(read_only=True)
    status = serializers.SerializerMethodField(read_only=True)
    is_active = serializers.SerializerMethodField(read_only=True)
    tenant = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Unit
        fields = [
            'id', 
            'unit_no', 
            'unitNo', 
            'unit_name', 
            'unitName', 
            'property', 
            'property_name', 
            'landlord_name', 
            'rent_amount',
            'deposit',
            'security_fee',
            'electricity_fee',
            'internet_fee',
            'water_rate',
            'garbage_fee',
            'unit_type', 
            'unitType', 
            'category', 
            'unitCategory', 
            'tenant_name', 
            'tenant', 
            'is_occupied', 
            'vacancy', 
            'status',
            'is_active',
        ]
        extra_kwargs = {
            'unit_name': {'required': False, 'allow_null': True, 'allow_blank': True},
            'rent_amount': {'required': False, 'allow_null': True},
            'deposit': {'required': False, 'allow_null': True},
            'security_fee': {'required': False, 'allow_null': True},
            'electricity_fee': {'required': False, 'allow_null': True},
            'internet_fee': {'required': False, 'allow_null': True},
            'water_rate': {'required': False, 'allow_null': True},
            'garbage_fee': {'required': False, 'allow_null': True},
            'is_occupied': {'required': False},
        }

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.property:
            representation['property'] = instance.property.name
            representation['propertyName'] = instance.property.name
        else:
            representation['property'] = '-'
            representation['propertyName'] = '-'
        return representation

    def get_landlord_name(self, obj):
        if getattr(obj, 'property', None) and getattr(obj.property, 'landlord', None):
            landlord = obj.property.landlord
            return getattr(landlord, 'name', getattr(landlord, 'full_name', '-'))
        return '-'

    def get_tenant_name(self, obj):
        if hasattr(obj, 'leases'):
            active_lease = obj.leases.filter(status='Active').first()
            if active_lease and getattr(active_lease, 'tenant', None):
                tenant = active_lease.tenant
                return getattr(tenant, 'name', getattr(tenant, 'full_name', 'Vacant'))
        return 'Vacant'

    def get_tenant(self, obj):
        if hasattr(obj, 'leases'):
            active_lease = obj.leases.filter(status='Active').first()
            if active_lease and getattr(active_lease, 'tenant', None):
                return active_lease.tenant.id
        return None

    def get_vacancy(self, obj):
        return 'Occupied' if getattr(obj, 'is_occupied', False) else 'Vacant'

    def get_status(self, obj):
        if hasattr(obj, 'status') and obj.status:
            return obj.status
        return 'Occupied' if getattr(obj, 'is_occupied', False) else 'Available'

    def get_is_active(self, obj):
        current_status = str(self.get_status(obj)).lower()
        return current_status not in ['suspended', 'inactive', 'maintenance']