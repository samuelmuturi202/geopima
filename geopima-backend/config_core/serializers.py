from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
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

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        
        role_permissions = []
        role_name = "Field Agent"
        
        profile_obj = UserProfile.objects.filter(user=user).first()
        if profile_obj and profile_obj.role:
            role_name = profile_obj.role.name
            role_permissions = profile_obj.role.permissions
        elif user.groups.exists():
            role_name = user.groups.first().name

        user_permissions = list(set(list(user.get_all_permissions()) + role_permissions))
        groups = list(user.groups.values_list('name', flat=True))
        if role_name not in groups:
            groups.append(role_name)

        data['user'] = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip() or user.username,
            'is_superuser': user.is_superuser,
            'is_staff': user.is_staff,
            'roles': groups,
            'role': role_name,
            'permissions': user_permissions,
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
            'username': {'required': True}
        }

    def get_name(self, obj):
        full = f"{obj.first_name} {obj.last_name}".strip()
        return full if full else obj.username

    def get_role(self, obj):
        profile = UserProfile.objects.filter(user=obj).first()
        return profile.role.name if profile and profile.role else "super admin"

    def get_user_phone(self, obj):
        profile = UserProfile.objects.filter(user=obj).first()
        return profile.phone if profile else ''

    def get_user_position(self, obj):
        profile = UserProfile.objects.filter(user=obj).first()
        return profile.position if profile else ''

    def get_permissions(self, obj):
        profile = UserProfile.objects.filter(user=obj).first()
        if profile and profile.role and hasattr(profile.role, 'permissions'):
            return profile.role.permissions
        return []

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
            username=validated_data['username'],
            email=validated_data['email'],
            password=password,
            first_name=first_name,
            last_name=last_name
        )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if role:
            profile.role = role
        if phone:
            profile.phone = phone
        if position:
            profile.position = position
        profile.save()

        if role:
            group, _ = Group.objects.get_or_create(name=role.name)
            user.groups.add(group)

        return user


class AgencyProfileSerializer(serializers.ModelSerializer):
    contact2 = serializers.CharField(source='contact_2', required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = AgencyProfile
        fields = [
            'id', 'company_name', 'short_name', 'motto_slogan', 
            'contact', 'contact2', 'email', 'physical_address', 
            'postal_address', 'website', 'end_month_transition', 'logo'
        ]
        extra_kwargs = {
            'company_name': {'required': False, 'allow_blank': True},
            'email': {'required': False, 'allow_blank': True},
            'logo': {'required': False, 'allow_null': True}
        }


class MessengerConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessengerConfig
        fields = '__all__'


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


class UserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRole
        fields = ['id', 'name', 'permissions']


class PaymentBankSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentBank
        fields = '__all__'


class SMSTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SMSTemplate
        fields = ['id', 'category', 'template_text', 'updated_at']


class AgreementTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgreementTemplate
        fields = '__all__'