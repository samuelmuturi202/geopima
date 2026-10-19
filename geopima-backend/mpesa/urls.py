from django.urls import path
from .views import (
    MpesaValidationView,
    MpesaConfirmationView,
    MpesaTransactionListView,
    MpesaTransactionDetailView,
    ManualSettlementView,
)

app_name = 'mpesa'

urlpatterns = [
    # C2B Webhook Callback Endpoints
    path('c2b/validation/', MpesaValidationView.as_view(), name='c2b_validation'),
    path('c2b/confirmation/', MpesaConfirmationView.as_view(), name='c2b_confirmation'),

    # Admin/Staff Dashboard Routes
    path('transactions/', MpesaTransactionListView.as_view(), name='transaction_list'),
    path('transactions/<int:pk>/', MpesaTransactionDetailView.as_view(), name='transaction_detail'),
    path('transactions/<int:pk>/reprocess/', ManualSettlementView.as_view(), name='manual_settlement'),
]