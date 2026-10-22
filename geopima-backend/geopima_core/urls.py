from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

# Import the dashboard views directly from billing
from billing.views import DashboardMetricsView, PaymentSummariesView

# Root view function to fix root 404 on Render
def api_root(request):
    return JsonResponse({
        "status": "online",
        "service": "Geopima WebGIS API Backend",
        "message": "Welcome to Geopima REST API",
        "endpoints": {
            "admin": "/admin/",
            "auth_token": "/api/v1/token/",
            "dashboard_metrics": "/api/v1/dashboard/metrics/",
            "dashboard_payments": "/api/v1/dashboard/payment-summaries/",
            "tenants": "/api/v1/tenants/",
            "properties": "/api/v1/properties/",
            "billing": "/api/v1/billing/",
            "mpesa": "/api/v1/mpesa/",
            "config_core": "/api/v1/"
        }
    })

urlpatterns = [
    # Root API welcome path
    path('', api_root, name='api-root'),

    # Admin Portal
    path('admin/', admin.site.urls),

    # Authentication API
    path('api/v1/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Explicit Dashboard Endpoints
    path('api/v1/dashboard/metrics/', DashboardMetricsView.as_view(), name='dashboard-metrics'),
    path('api/v1/dashboard/payment-summaries/', PaymentSummariesView.as_view(), name='dashboard-payment-summaries'),

    # Application APIs
    path('api/v1/tenants/', include('tenants.urls')),
    path('api/v1/properties/', include('properties.urls')),
    path('api/v1/billing/', include('billing.urls')),
    path('api/v1/mpesa/', include('mpesa.urls')),
    path('api/v1/', include('config_core.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)