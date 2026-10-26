import os
from rest_framework import viewsets, mixins, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model

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
from .permissions import IsSuperAdminOrAdmin, CanManageFinances, CanManageTemplates
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
        role_name = "Field Agent"
        role_permissions = []
        
        if hasattr(user, 'role') and user.role:
            role_name = user.role.name
            role_permissions = user.role.permissions
        elif user.groups.exists():
            role_name = user.groups.first().name

        user_permissions = list(set(list(user.get_all_permissions()) + role_permissions))

        data = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip() or user.username,
            "role": role_name,
            "permissions": user_permissions,
            "is_superuser": user.is_superuser
        }
        return Response(data)


class DashboardMetricsView(APIView):
    permission_classes = [IsAuthenticated]

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
    permission_classes = [IsAuthenticated, CanManageFinances]

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
    permission_classes = [IsAuthenticated, IsSuperAdminOrAdmin]
    serializer_class = AgencyProfileSerializer

    def get_object(self):
        obj, _ = AgencyProfile.objects.get_or_create(id=1)
        return obj


class MessengerConfigViewSet(viewsets.GenericViewSet, mixins.RetrieveModelMixin, mixins.UpdateModelMixin):
    permission_classes = [IsAuthenticated, IsSuperAdminOrAdmin]
    serializer_class = MessengerConfigSerializer

    def get_object(self):
        obj, _ = MessengerConfig.objects.get_or_create(id=1)
        return obj


class MailerConfigViewSet(viewsets.GenericViewSet, mixins.RetrieveModelMixin, mixins.UpdateModelMixin):
    permission_classes = [IsAuthenticated, IsSuperAdminOrAdmin]
    serializer_class = MailerConfigSerializer

    def get_object(self):
        obj, _ = MailerConfig.objects.get_or_create(id=1)
        return obj


class MpesaConfigViewSet(viewsets.GenericViewSet, mixins.RetrieveModelMixin, mixins.UpdateModelMixin):
    permission_classes = [IsAuthenticated, IsSuperAdminOrAdmin]
    serializer_class = MpesaConfigSerializer

    def get_object(self):
        obj, _ = MpesaConfig.objects.get_or_create(id=1)
        return obj


class CreditBankConfigViewSet(viewsets.GenericViewSet, mixins.RetrieveModelMixin, mixins.UpdateModelMixin):
    permission_classes = [IsAuthenticated, IsSuperAdminOrAdmin]
    serializer_class = CreditBankConfigSerializer

    def get_object(self):
        obj, created = CreditBankConfig.objects.get_or_create(id=1)
        if created or not obj.client_id:
            obj.client_id = os.getenv('CREDIT_BANK_SANDBOX_ID', '')
            obj.secret_key = os.getenv('CREDIT_BANK_SECRET_KEY', '')
            obj.signing_key = os.getenv('CREDIT_BANK_SIGNING_KEY', '')
            obj.paybill_number = '4045619'
            obj.save()
        return obj


class UserRoleViewSet(viewsets.ModelViewSet):
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOrAdmin]


class UserAccountViewSet(viewsets.ModelViewSet):
    serializer_class = UserAccountSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOrAdmin]

    def get_queryset(self):
        return User.objects.all()


class PaymentBankViewSet(viewsets.ModelViewSet):
    queryset = PaymentBank.objects.all()
    serializer_class = PaymentBankSerializer
    permission_classes = [IsAuthenticated, CanManageFinances]


class SMSTemplateViewSet(viewsets.ModelViewSet):
    queryset = SMSTemplate.objects.all()
    serializer_class = SMSTemplateSerializer
    permission_classes = [IsAuthenticated, CanManageTemplates]

    @action(detail=False, methods=['post'], url_path='bulk-save')
    def bulk_save(self, request):
        data = request.data
        if not isinstance(data, list):
            return Response(
                {"error": "Expected a list of templates."},
                status=status.HTTP_400_BAD_REQUEST
            )

        updated_objects = []
        for item in data:
            category = item.get('category')
            text = item.get('template_text')
            if category and text:
                obj, _ = SMSTemplate.objects.update_or_create(
                    category=category,
                    defaults={'template_text': text}
                )
                updated_objects.append(obj)

        serializer = self.get_serializer(updated_objects, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='bulk-update')
    def bulk_update(self, request):
        return self.bulk_save(request)


class AgreementTemplateViewSet(viewsets.ModelViewSet):
    queryset = AgreementTemplate.objects.all()
    serializer_class = AgreementTemplateSerializer
    permission_classes = [IsAuthenticated, CanManageTemplates]