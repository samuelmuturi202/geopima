import uuid
from decimal import Decimal
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


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
    tenant = models.ForeignKey('tenants.Tenant', to_field='tenant_id', on_delete=models.PROTECT, related_name='deposits')
    unit = models.ForeignKey('properties.Unit', on_delete=models.PROTECT, related_name='deposits')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, default='held')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.deposit_code} - {self.tenant}"


class SmartAliasTransaction(models.Model):
    """Logs incoming webhook payloads from Credit Bank Smart Alias collection."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction_reference = models.CharField(max_length=100, unique=True)
    account_alias = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    sender_name = models.CharField(max_length=255, blank=True, null=True)
    paybill_number = models.CharField(max_length=50, default='6775')
    raw_payload = models.JSONField()
    is_processed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name='smart_alias_tx_amount_positive',
            ),
        ]

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
    tenant = models.ForeignKey('tenants.Tenant', to_field='tenant_id', on_delete=models.PROTECT, related_name='invoices')
    unit = models.ForeignKey('properties.Unit', on_delete=models.PROTECT, related_name='invoices')
    
    billing_period = models.DateField()
    issue_date = models.DateField(auto_now_add=True)
    due_date = models.DateField()

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unpaid')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'billing_invoice'
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'unit', 'billing_period'],
                name='unique_invoice_tenant_unit_period',
            ),
        ]
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
        allocations = getattr(self, 'allocations', None)
        if allocations:
            return sum(payment.amount_allocated for payment in allocations.all())
        return Decimal('0.00')

    @property
    def balance(self) -> Decimal:
        return self.net_total - self.rent_paid

    @property
    def is_cleared(self) -> bool:
        return self.balance <= 0

    def save(self, *args, **kwargs):
        if self._state.adding or self._relationship_changed('tenant_id', 'unit_id'):
            if not self.tenant_id or self.tenant.unit_id != self.unit_id:
                raise ValueError('Invoice tenant must be assigned to the invoice unit.')

        if not self.invoice_number:
            last_invoice = Invoice.objects.all().order_by('-created_at').first()
            if last_invoice and last_invoice.invoice_number.startswith('INV'):
                try:
                    last_num = int(last_invoice.invoice_number.replace('INV', ''))
                    next_num = last_num + 1
                except ValueError:
                    next_num = 1
            else:
                next_num = 1
            
            self.invoice_number = f"INV{next_num:06d}"

        if self.rent_paid >= self.net_total and self.net_total > 0:
            self.status = 'paid'
        elif self.rent_paid > 0:
            self.status = 'partially_paid'
        elif self.due_date < timezone.localdate():
            self.status = 'overdue'
        else:
            self.status = 'unpaid'

        super().save(*args, **kwargs)

    def _relationship_changed(self, *field_names):
        if not self.pk:
            return True
        original = type(self).objects.filter(pk=self.pk).values(*field_names).first()
        return original is not None and any(
            original[field_name] != getattr(self, field_name)
            for field_name in field_names
        )

    def __str__(self):
        return f"{self.invoice_number} - {self.tenant} ({self.period_formatted})"


class InvoiceItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_destroy=models.CASCADE, related_name='items') if hasattr(models, 'on_destroy') else models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    item_type = models.CharField(max_length=50, default="Rent")
    description = models.CharField(max_length=255, default="House Rent")
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gte=0),
                name='invoice_item_amount_nonnegative',
            ),
        ]

    def __str__(self):
        return f"{self.item_type}: {self.amount}"


class CommunicationDraft(models.Model):
    RECIPIENT_CHOICES = [
        ('tenant', 'Tenant'),
        ('landlord', 'Landlord'),
    ]
    REMINDER_CHOICES = [
        ('rent_due', 'Rent due soon'),
        ('rent_overdue', 'Overdue rent'),
        ('landlord_monthly', 'Monthly landlord update'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending approval'),
        ('approved', 'Approved'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
        ('unknown', 'Delivery uncertain'),
    ]

    recipient_type = models.CharField(max_length=10, choices=RECIPIENT_CHOICES)
    recipient_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20)
    reminder_type = models.CharField(max_length=20, choices=REMINDER_CHOICES)
    message = models.TextField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    provider_message_id = models.CharField(max_length=100, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, null=True, blank=True, related_name='communication_drafts'
    )
    landlord = models.ForeignKey(
        'properties.Landlord', on_delete=models.CASCADE, null=True, blank=True,
        related_name='communication_drafts'
    )
    period = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_communication_drafts'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['invoice', 'reminder_type'],
                condition=Q(invoice__isnull=False),
                name='uniq_com_draft_invoice_type',
            ),
            models.UniqueConstraint(
                fields=['landlord', 'reminder_type', 'period'],
                condition=Q(landlord__isnull=False, period__isnull=False),
                name='uniq_com_draft_landlord_period',
            ),
        ]

    def __str__(self):
        return f"{self.get_reminder_type_display()} for {self.recipient_name}"