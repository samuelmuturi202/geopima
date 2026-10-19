from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TenantViewSet, LeaseAgreementViewSet

app_name = 'tenants'

# Initialize DRF Router to handle RESTful CRUD routing
router = DefaultRouter()
router.register(r'agreements', LeaseAgreementViewSet, basename='lease-agreement')
router.register(r'tenants', TenantViewSet, basename='tenant')

urlpatterns = [
    path('', include(router.urls)),
]