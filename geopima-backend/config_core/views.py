import os
from rest_framework import viewsets, mixins, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.exceptions import NotFound
from django.contrib.auth import get_user_model
from django.db import transaction as db_transaction

from properties.models import Property
from billing.models import VoteHead
from .models import (
    AgencyProfile, 
    MessengerConfig, 
    MailerConfig, 
    MpesaConfig, 
    CreditBankConfig,
    UserRole, 
    PaymentBank, 
    SMSTemplate, 
    AgreementTemplate
)
from .permissions import RolePermission, get_user_role_permissions
from .serializers import (
    CustomTokenObtainPairSerializer,
    AgencyProfileSerializer, 
    MessengerConfigSerializer,
    MailerConfigSerializer,
    MpesaConfigSerializer,
    CreditBankConfigSerializer,
    UserRoleSerializer,
    PaymentBankSerializer, 
    SMSTemplateSerializer, 
    AgreementTemplateSerializer,
    UserAccountSerializer
)

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile = getattr(user, 'profile', None)
        roles = []
        if profile and profile.role:
            roles.append(profile.role)
        roles.extend(
            role for role in user.roles.all()
            if all(role.pk != assigned.pk for assigned in roles)
        )
        user_permissions = sorted(get_user_role_permissions(user))

        data = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip() or user.username,
            "role": roles[0].name if roles else "No role",
            "roles": [role.name for role in roles],
            "permissions": user_permissions,
            "is_superuser": user.is_superuser
        }
        return Response(data)


class DashboardMetricsView(APIView):
    permission_classes = [RolePermission]
    role_permission_module = 'reports'

    def get(self, request):
        properties = Property.objects.all()
        prop_names = [p.name for p in properties]
        total_units = [p.units.count() for p in properties]
        occupied_units = [p.units.filter(is_occupied=True).count() for p in properties]

        return Response({
            'properties': prop_names,
            'total_units': total_units,
            'occupied_units': occupied_units
        })


class PaymentSummariesView(APIView):
    permission_classes = [RolePermission]
    role_permission_module = 'payment'

    def get(self, request):
        vote_heads = VoteHead.objects.all()
        data = []
        for v in vote_heads:
            collected = getattr(v, 'collected_amount', 0)
            total = getattr(v, 'target_amount', 1000)
            pct = round((collected / total) * 100, 1) if total > 0 else 0
            data.append({
                'name': getattr(v, 'name', None) or getattr(v, 'title', 'Summary'),
                'collected': collected,
                'total': total,
                'pct': pct
            })
        return Response(data)


class AgencyProfileViewSet(viewsets.GenericViewSet, mixins.RetrieveModelMixin, mixins.UpdateModelMixin):
    permission_classes = [RolePermission]
    role_permission_module = 'settings'
    serializer_class = AgencyProfileSerializer

    def get_object(self):
        obj, _ = AgencyProfile.objects.get_or_create(id=1)
        return obj


class MessengerConfigViewSet(viewsets.GenericViewSet, mixins.RetrieveModelMixin, mixins.UpdateModelMixin):
    permission_classes = [RolePermission]
    role_permission_module = 'settings'
    serializer_class = MessengerConfigSerializer

    def get_object(self):
        obj, _ = MessengerConfig.objects.get_or_create(id=1)
        return obj


class MailerConfigViewSet(viewsets.GenericViewSet, mixins.RetrieveModelMixin, mixins.UpdateModelMixin):
    permission_classes = [RolePermission]
    role_permission_module = 'settings'
    serializer_class = MailerConfigSerializer

    def get_object(self):
        obj, _ = MailerConfig.objects.get_or_create(id=1)
        return obj


class MpesaConfigViewSet(viewsets.GenericViewSet, mixins.RetrieveModelMixin, mixins.UpdateModelMixin):
    permission_classes = [RolePermission]
    role_permission_module = 'settings'
    serializer_class = MpesaConfigSerializer

    def get_object(self):
        obj, _ = MpesaConfig.objects.get_or_create(id=1)
        return obj


class CreditBankConfigViewSet(viewsets.GenericViewSet, mixins.RetrieveModelMixin, mixins.UpdateModelMixin):
    permission_classes = [RolePermission]
    role_permission_module = 'settings'
    serializer_class = CreditBankConfigSerializer

    def get_object(self):
        obj, _ = CreditBankConfig.objects.get_or_create(
            id=1,
            defaults={
                'paybill_number': os.getenv('CREDIT_BANK_PAYBILL_NUMBER', '6775'),
                'client_id': os.getenv('CREDIT_BANK_SANDBOX_ID', ''),
                'secret_key': os.getenv('CREDIT_BANK_SECRET_KEY', ''),
                'signing_key': os.getenv('CREDIT_BANK_SIGNING_KEY', ''),
            },
        )
        return obj


class UserRoleViewSet(viewsets.ModelViewSet):
    queryset = UserRole.objects.all().order_by('-id')
    serializer_class = UserRoleSerializer
    permission_classes = [RolePermission]
    role_permission_module = 'user'


class UserAccountViewSet(viewsets.ModelViewSet):
    serializer_class = UserAccountSerializer
    permission_classes = [RolePermission]
    role_permission_module = 'user'

    def get_queryset(self):
        return User.objects.all().order_by('-id')

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
        
        obj = queryset.filter(**filter_kwargs).first()
        if obj is None:
            raise NotFound("No User matches the given query.")
            
        self.check_object_permissions(self.request, obj)
        return obj


class PaymentBankViewSet(viewsets.ModelViewSet):
    queryset = PaymentBank.objects.all().order_by('-id')
    serializer_class = PaymentBankSerializer
    permission_classes = [RolePermission]
    role_permission_module = 'payment'
    pagination_class = None  # Returns a plain JSON list directly

    def destroy(self, request, *args, **kwargs):
        payment_bank = self.get_object()
        if payment_bank.bank_type == 'smart_alias':
            return Response(
                {'error': 'The Credit Bank Smart Alias channel cannot be deleted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class SMSTemplateViewSet(viewsets.ModelViewSet):
    queryset = SMSTemplate.objects.all().order_by('-id')
    serializer_class = SMSTemplateSerializer
    permission_classes = [RolePermission]
    role_permission_module = 'message'
    pagination_class = None

    @action(detail=False, methods=['post'], url_path='bulk-save')
    def bulk_save(self, request):
        data = request.data
        if not isinstance(data, list):
            return Response(
                {"error": "Expected a list of templates."},
                status=status.HTTP_400_BAD_REQUEST
            )

        valid_categories = {category for category, _ in SMSTemplate.CATEGORY_CHOICES}
        for index, item in enumerate(data):
            if not isinstance(item, dict):
                return Response(
                    {"error": f"Template at index {index} must be an object."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            category = item.get('category')
            text = item.get('template_text')
            if category not in valid_categories:
                return Response(
                    {"error": f"Invalid SMS template category at index {index}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not isinstance(text, str) or not text.strip():
                return Response(
                    {"error": f"Template text at index {index} cannot be empty."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        updated_objects = []
        for item in data:
            category = item.get('category')
            text = item.get('template_text')
            obj, _ = SMSTemplate.objects.update_or_create(
                category=category,
                defaults={'template_text': text.strip()}
            )
            updated_objects.append(obj)

        serializer = self.get_serializer(updated_objects, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='bulk-update')
    def bulk_update(self, request):
        return self.bulk_save(request)


class AgreementTemplateViewSet(viewsets.ModelViewSet):
    queryset = AgreementTemplate.objects.all().order_by('-id')
    serializer_class = AgreementTemplateSerializer
    permission_classes = [RolePermission]
    role_permission_module = 'settings'