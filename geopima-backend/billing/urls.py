from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    VoteHeadViewSet, 
    DepositViewSet, 
    InvoiceViewSet,
    DashboardMetricsView,
    PaymentSummariesView,
    CreditBankSmartAliasWebhookView
)

app_name = 'billing'

# Initialize DRF Router
router = DefaultRouter()
router.register(r'vote-heads', VoteHeadViewSet, basename='vote-head')
router.register(r'deposits', DepositViewSet, basename='deposit')
router.register(r'invoices', InvoiceViewSet, basename='invoice')

# Wire up API routes
urlpatterns = [
    path('webhooks/credit-bank/smart-alias/', CreditBankSmartAliasWebhookView.as_view(), name='smart-alias-webhook'),
    path('dashboard/metrics/', DashboardMetricsView.as_view(), name='dashboard-metrics'),
    path('dashboard/payment-summaries/', PaymentSummariesView.as_view(), name='payment-summaries'),
    path('', include(router.urls)),
]