from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CustomTokenObtainPairView,
    DashboardMetricsView,
    PaymentSummariesView,
    AgencyProfileViewSet,
    MessengerConfigViewSet,
    MailerConfigViewSet,
    MpesaConfigViewSet,
    UserRoleViewSet,
    PaymentBankViewSet,
    SMSTemplateViewSet,
    AgreementTemplateViewSet,
    CurrentUserView,
    UserAccountViewSet
)

app_name = 'config_core'

router = DefaultRouter()
router.register(r'agency-profile', AgencyProfileViewSet, basename='agency-profile')
router.register(r'messenger-configs', MessengerConfigViewSet, basename='messenger-configs')
router.register(r'mailer-configs', MailerConfigViewSet, basename='mailer-configs')
router.register(r'mpesa-configs', MpesaConfigViewSet, basename='mpesa-configs')
router.register(r'user-roles', UserRoleViewSet, basename='user-role')
router.register(r'users', UserAccountViewSet, basename='user-account')
router.register(r'payment-banks', PaymentBankViewSet, basename='payment-bank')
router.register(r'sms-templates', SMSTemplateViewSet, basename='sms-template')
router.register(r'agreement-templates', AgreementTemplateViewSet, basename='agreement-template')

urlpatterns = [
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', CurrentUserView.as_view(), name='current-user'),
    path('dashboard/metrics/', DashboardMetricsView.as_view(), name='dashboard-metrics'),
    path('dashboard/payment-summaries/', PaymentSummariesView.as_view(), name='payment-summaries'),
    path('', include(router.urls)),
]