from django.db import models
from tenants.models import Tenant
from billing.models import Invoice


class MpesaTransaction(models.Model):
    trans_id = models.CharField(max_length=100, unique=True)
    trans_time = models.CharField(max_length=50)
    trans_amount = models.DecimalField(max_digits=12, decimal_places=2)
    business_short_code = models.CharField(max_length=20)
    bill_ref_number = models.CharField(max_length=100)
    msisdn = models.CharField(max_length=20)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_settled = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.trans_id} - {self.trans_amount} KES"


class PaymentSettlement(models.Model):
    transaction = models.OneToOneField(MpesaTransaction, on_delete=models.CASCADE)
    tenant = models.ForeignKey(Tenant, to_field='tenant_id', on_delete=models.CASCADE, related_name='payments')
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, null=True, blank=True, related_name='settlements')
    amount_applied = models.DecimalField(max_digits=12, decimal_places=2)
    settled_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Settlement: {self.transaction.trans_id} -> {self.tenant.name}"