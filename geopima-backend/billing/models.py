import uuid
from decimal import Decimal
from django.db import models


class Agency(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150, default="PEMWA AGENCY")
    address = models.CharField(max_length=255, default="1254-00200, GPO Nairobi")
    email = models.EmailField(default="pemwaagency@yahoo.com")
    contact_numbers = models.CharField(max_length=100, default="0725768616 | 0101768816")

    class Meta:
        verbose_name_plural = "Agencies"

    def __str__(self):
        return self.name


class VoteHead(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    title = models.CharField(max_length=100, blank=True, null=True)
    code = models.CharField(max_length=30, unique=True)
    description = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, default='active')
    priority_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['priority_order']

    def __str__(self):
        return f"{self.code} - {self.name}"


class Deposit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deposit_code = models.CharField(max_length=50, unique=True)
    reference_no = models.CharField(max_length=50, blank=True, null=True)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.PROTECT, related_name='deposits')
    unit = models.ForeignKey('properties.Unit', on_delete=models.PROTECT, related_name='deposits')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, default='held')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.deposit_code} - {self.tenant}"


class SmartAliasTransaction(models.Model):
    """Logs incoming webhook payloads from Credit Bank Smart Alias collection service (Paybill 4045619)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction_reference = models.CharField(max_length=100, unique=True)
    account_alias = models.CharField(max_length=100)  # e.g., "House No. 1"
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    sender_name = models.CharField(max_length=255, blank=True, null=True)
    paybill_number = models.CharField(max_length=50, default='4045619')
    raw_payload = models.JSONField()
    is_processed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.account_alias} - KES {self.amount} ({self.transaction_reference})"


class Invoice(models.Model):
    STATUS_CHOICES = [
        ('unpaid', 'Unpaid'),
        ('partially_paid', 'Partially Paid'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice_number = models.CharField(max_length=30, unique=True, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.PROTECT, related_name='invoices')
    unit = models.ForeignKey('properties.Unit', on_delete=models.PROTECT, related_name='invoices')
    
    billing_period = models.DateField()
    issue_date = models.DateField(auto_now_add=True)
    due_date = models.DateField()

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unpaid')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'billing_invoice'
        unique_together = ('tenant', 'unit', 'billing_period')
        ordering = ['-billing_period', '-created_at']

    @property
    def period_formatted(self) -> str:
        return self.billing_period.strftime('%B-%Y').upper()

    @property
    def subtotal(self) -> Decimal:
        return sum(item.amount for item in self.items.all())

    @property
    def net_total(self) -> Decimal:
        return self.subtotal

    @property
    def rent_paid(self) -> Decimal:
        return sum(payment.amount_allocated for payment in self.allocations.all())

    @property
    def balance(self) -> Decimal:
        return self.net_total - self.rent_paid

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            count = Invoice.objects.filter(billing_period=self.billing_period).count() + 1
            self.invoice_number = f"INV{count:06d}"
        super().save(*args, **kwargs)


class InvoiceItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    item_type = models.CharField(max_length=50, default="Rent")
    description = models.CharField(max_length=255, default="House Rent")
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.item_type}: {self.amount}"