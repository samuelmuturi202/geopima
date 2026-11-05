from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    VoteHeadViewSet, 
    DepositViewSet, 
    InvoiceViewSet,
    CommunicationDraftViewSet,
    DashboardMetricsView,
    PaymentSummariesView,
    CreditBankSmartAliasWebhookView
)
from mpesa.views import RentCollectionListAPIView, RentCollectionDetailAPIView

app_name = 'billing'

router = DefaultRouter()
router.register(r'vote-heads', VoteHeadViewSet, basename='vote-head')
router.register(r'deposits', DepositViewSet, basename='deposit')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'communication-drafts', CommunicationDraftViewSet, basename='communication-draft')

urlpatterns = [
    path('webhooks/credit-bank/smart-alias/', CreditBankSmartAliasWebhookView.as_view(), name='smart-alias-webhook'),
    path('dashboard/metrics/', DashboardMetricsView.as_view(), name='dashboard-metrics'),
    path('dashboard/payment-summaries/', PaymentSummariesView.as_view(), name='dashboard-payment-summaries'),
    path('rent-collections/', RentCollectionListAPIView.as_view(), name='rent_collection_list'),
    path('rent-collections/<int:pk>/', RentCollectionDetailAPIView.as_view(), name='rent_collection_detail'),
    path('', include(router.urls)),
]