from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.db import transaction
from .models import (
    AgencyProfile, 
    MessengerConfig, 
    MailerConfig, 
    MpesaConfig, 
    CreditBankConfig,
    UserRole, 
    UserProfile, 
    PaymentBank, 
    SMSTemplate, 
    AgreementTemplate
)
from .permissions import (
    PERMISSION_ACTIONS,
    PERMISSION_MODULES,
    get_user_role_permissions,
)

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        
        profile_obj = UserProfile.objects.filter(user=user).first()
        roles = []
        if profile_obj and profile_obj.role:
            roles.append(profile_obj.role)
        roles.extend(
            role for role in user.roles.all()
            if all(role.pk != assigned.pk for assigned in roles)
        )

        data['user'] = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip() or user.username,
            'is_superuser': user.is_superuser,
            'is_staff': user.is_staff,
            'roles': [role.name for role in roles],
            'role': roles[0].name if roles else 'No role',
            'permissions': sorted(get_user_role_permissions(user)),
        }
        return data


class UserAccountSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    full_name = serializers.CharField(write_only=True, required=False)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    position = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=UserRole.objects.all(),
        source='profile.role',
        write_only=True,
        required=False,
        allow_null=True
    )
    role = serializers.SerializerMethodField(read_only=True)
    name = serializers.SerializerMethodField(read_only=True)
    user_phone = serializers.SerializerMethodField(read_only=True)
    user_position = serializers.SerializerMethodField(read_only=True)
    date_joined = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)
    permissions = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'password', 'full_name', 'name', 
            'phone', 'user_phone', 'role_id', 'role', 'position', 'user_position', 
            'is_active', 'date_joined', 'is_superuser', 'permissions'
        ]
        extra_kwargs = {
            'email': {'required': True},
            'username': {'required': True},
            'is_superuser': {'read_only': True},
        }

    def get_name(self, obj):
        full = f"{obj.first_name} {obj.last_name}".strip()
        return full if full else obj.username

    def get_role(self, obj):
        profile = UserProfile.objects.filter(user=obj).first()
        return profile.role.name if profile and profile.role else "No role"

    def get_user_phone(self, obj):
        profile = UserProfile.objects.filter(user=obj).first()
        return profile.phone if profile else ''

    def get_user_position(self, obj):
        profile = UserProfile.objects.filter(user=obj).first()
        return profile.position if profile else ''

    def get_permissions(self, obj):
        return sorted(get_user_role_permissions(obj))

    @transaction.atomic
    def create(self, validated_data):
        profile_data = validated_data.pop('profile', {})
        role = profile_data.get('role', None)
        full_name = validated_data.pop('full_name', '')
        phone = validated_data.pop('phone', '')
        position = validated_data.pop('position', '')
        password = validated_data.pop('password')

        name_parts = full_name.split(' ', 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        user = User.objects.create_user(
            password=password,
            first_name=first_name,
            last_name=last_name,
            **validated_data,
        )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        if phone:
            profile.phone = phone
        if position:
            profile.position = position
        profile.save()
        user.roles.set([role] if role else [])

        return user

    @transaction.atomic
    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})
        role_was_provided = 'role' in profile_data
        role = profile_data.get('role')
        full_name = validated_data.pop('full_name', None)
        phone = validated_data.pop('phone', None)
        position = validated_data.pop('position', None)
        password = validated_data.pop('password', None)

        if full_name is not None:
            first_name, _, last_name = full_name.strip().partition(' ')
            instance.first_name = first_name
            instance.last_name = last_name.strip()
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()

        profile, _ = UserProfile.objects.get_or_create(user=instance)
        if role_was_provided:
            profile.role = role
            instance.roles.set([role] if role else [])
        if phone is not None:
            profile.phone = phone
        if position is not None:
            profile.position = position
        profile.save()
        return instance


class AgencyProfileSerializer(serializers.ModelSerializer):
    contact2 = serializers.CharField(source='contact_2', required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = AgencyProfile
        fields = '__all__'


class MessengerConfigSerializer(serializers.ModelSerializer):
    partner_key = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        trim_whitespace=False,
    )
    credentials_configured = serializers.SerializerMethodField()

    class Meta:
        model = MessengerConfig
        fields = '__all__'
        read_only_fields = ['id']

    def get_credentials_configured(self, obj):
        return bool(obj.partner_id and obj.partner_key)


class MailerConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = MailerConfig
        fields = '__all__'


class MpesaConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = MpesaConfig
        fields = '__all__'


class CreditBankConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditBankConfig
        fields = '__all__'

    def validate_paybill_number(self, value):
        value = value.strip()
        if not value.isdigit():
            raise serializers.ValidationError('Paybill number must contain digits only.')
        return value

    @transaction.atomic
    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        PaymentBank.objects.filter(bank_type='smart_alias').update(
            business_no=instance.paybill_number
        )
        PaymentBank.objects.get_or_create(
            bank_type='smart_alias',
            defaults={
                'short_name': 'Credit Bank',
                'long_name': 'Credit Bank Smart Alias',
                'acc_name': 'Tenant Payments',
                'business_no': instance.paybill_number,
                'acc_number': 'Tenant Smart Alias',
                'is_active': True,
                'on_invoice': True,
            },
        )
        return instance


class UserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRole
        fields = ['id', 'name', 'permissions']

    def validate_permissions(self, permissions):
        if not isinstance(permissions, list):
            raise serializers.ValidationError('Permissions must be a list.')
        valid = {
            f'{module}_{action}'
            for module in PERMISSION_MODULES
            for action in PERMISSION_ACTIONS
        }
        invalid = [
            permission for permission in permissions
            if not isinstance(permission, str)
            or permission.strip().lower() not in valid
        ]
        if invalid:
            raise serializers.ValidationError(
                'Unknown role permission(s): '
                + ', '.join(str(permission) for permission in invalid)
            )
        return sorted({permission.strip().lower() for permission in permissions})


class PaymentBankSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentBank
        fields = '__all__'

    def validate(self, attrs):
        bank_type = attrs.get(
            'bank_type',
            self.instance.bank_type if self.instance else 'bank',
        )
        if (
            self.instance
            and self.instance.bank_type == 'smart_alias'
            and bank_type != 'smart_alias'
        ):
            raise serializers.ValidationError({
                'bank_type': 'The Credit Bank Smart Alias channel cannot be converted.'
            })
        if bank_type == 'smart_alias':
            credit_bank = CreditBankConfig.objects.filter(pk=1).first()
            paybill = credit_bank.paybill_number if credit_bank else '6775'
            supplied_paybill = attrs.get(
                'business_no',
                self.instance.business_no if self.instance else paybill,
            )
            if supplied_paybill != paybill:
                raise serializers.ValidationError({
                    'business_no': (
                        'Credit Bank Paybill must match the Credit Bank configuration '
                        f'({paybill}).'
                    )
                })
            attrs['business_no'] = paybill
        return attrs


class SMSTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SMSTemplate
        fields = ['id', 'category', 'template_text', 'updated_at']


class AgreementTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgreementTemplate
        fields = '__all__'