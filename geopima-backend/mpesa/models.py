from decimal import Decimal
from django.db import models
from tenants.models import Tenant
from billing.models import Invoice


class MpesaTransaction(models.Model):
    trans_id = models.CharField(max_length=100, unique=True)
    trans_time = models.CharField(max_length=50)
    trans_amount = models.DecimalField(max_digits=12, decimal_places=2)
    business_short_code = models.CharField(max_length=20)
    bill_ref_number = models.CharField(max_length=100) # Holds smart alias e.g. WP068-H1
    msisdn = models.CharField(max_length=20)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_settled = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.trans_id} - {self.trans_amount} KES"

    @property
    def resolved_tenant(self):
        settlement = self.payments.first()
        if settlement and settlement.tenant:
            return settlement.tenant
        return None

    @property
    def resolved_unit(self):
        tenant = self.resolved_tenant
        if tenant and hasattr(tenant, 'unit') and tenant.unit:
            return tenant.unit
        return None

    @property
    def resolved_property(self):
        unit = self.resolved_unit
        if unit and hasattr(unit, 'property') and unit.property:
            return unit.property
        return None

    def to_json_dict(self):
        tenant = self.resolved_tenant
        unit = self.resolved_unit
        prop = self.resolved_property
        
        return {
            "id": self.id,
            "transId": self.trans_id,
            "dateTime": self.trans_time or self.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            "accountNo": self.bill_ref_number,
            "tenant": tenant.name if tenant else "--",
            "property": prop.name if prop else "--",
            "unit": unit.unit_name if unit else "--",
            "payer": f"{self.first_name} {self.last_name}".strip() or "--",
            "amount": float(self.trans_amount),
            "status": "successful" if self.is_settled else "unsuccessful"
        }


class PaymentSettlement(models.Model):
    transaction = models.ForeignKey(MpesaTransaction, on_delete=models.CASCADE, related_name='payments')
    tenant = models.ForeignKey(Tenant, to_field='tenant_id', on_delete=models.CASCADE, related_name='settlements')
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, null=True, blank=True, related_name='settlements')
    receipt_number = models.CharField(max_length=50, unique=True, null=True, blank=True)
    amount_applied = models.DecimalField(max_digits=12, decimal_places=2)
    settled_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Settlement: {self.transaction.trans_id} -> {self.tenant.name}"