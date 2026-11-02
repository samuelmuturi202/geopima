from django.urls import path
from .views import (
    MpesaValidationView,
    MpesaConfirmationView,
    MpesaTransactionListAPIView,
    MpesaBatchVerifyAPIView,
    ManualSettlementAPIView,
)

app_name = 'mpesa'

urlpatterns = [
    # C2B Webhook Callback Endpoints
    path('c2b/validation/', MpesaValidationView.as_view(), name='c2b_validation'),
    path('c2b/confirmation/', MpesaConfirmationView.as_view(), name='c2b_confirmation'),

    # REST JSON API Endpoints for M-Pesa Dashboard (mpesa.js)
    path('paybill-transactions/', MpesaTransactionListAPIView.as_view(), name='transaction_list'),
    path('paybill-transactions/verify-batch/', MpesaBatchVerifyAPIView.as_view(), name='verify_batch'),
    path('paybill-transactions/<int:pk>/reprocess/', ManualSettlementAPIView.as_view(), name='manual_settlement'),
]