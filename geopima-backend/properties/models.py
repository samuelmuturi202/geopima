import re
import uuid
from django.db import models
from django.utils import timezone
from django.core.validators import FileExtensionValidator


class Landlord(models.Model):
    GENDER_CHOICES = [
        ('MALE', 'Male'),
        ('FEMALE', 'Female'),
        ('OTHER', 'Other'),
    ]
    landlord_id = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=255)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True)
    id_number = models.CharField(max_length=50, blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True)
    secondary_contact = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    address = models.CharField(max_length=255, blank=True)
    postal_address = models.CharField(max_length=255, blank=True, null=True)
    bank_name = models.CharField(max_length=100, blank=True, null=True)
    account_name = models.CharField(max_length=100, blank=True, null=True)
    account_number = models.CharField(max_length=50, blank=True, null=True)
    registration_date = models.DateField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.landlord_id} - {self.name}"


class Property(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('under_maintenance', 'Under Maintenance'),
        ('suspended', 'Suspended'),
    ]

    property_id = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=255)
    landlord = models.ForeignKey(Landlord, on_delete=models.CASCADE, related_name='properties')
    description = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    cluster = models.CharField(max_length=100, default='Cluster A')
    commission_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    
    # Default property-level bills & charges
    default_deposit = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    default_security_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    default_electricity_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    default_internet_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    default_garbage_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    default_water_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='active')
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "Properties"
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(property_id=''),
                name='property_id_not_blank',
            ),
        ]

    def save(self, *args, **kwargs):
        self.property_id = (self.property_id or '').strip().upper()
        if not self.property_id:
            raise ValueError('Property ID cannot be blank.')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class PropertyAgreement(models.Model):
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='agreements')
    agreement_file = models.FileField(
        upload_to='property_agreements/',
        validators=[FileExtensionValidator(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'])],
    )
    description = models.CharField(max_length=255)
    start_date = models.DateField()
    end_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_date', '-id']

    def save(self, *args, **kwargs):
        previous_file = None
        if self.pk:
            previous_file = type(self).objects.filter(pk=self.pk).values_list(
                'agreement_file', flat=True
            ).first()
        super().save(*args, **kwargs)
        if previous_file and previous_file != self.agreement_file.name:
            self.agreement_file.storage.delete(previous_file)

    def delete(self, *args, **kwargs):
        file_name = self.agreement_file.name
        result = super().delete(*args, **kwargs)
        if file_name:
            self.agreement_file.storage.delete(file_name)
        return result

    def __str__(self):
        return f'{self.property.name} - {self.description}'


def build_unit_smart_alias(property_code, house_name):
    prop_part = re.sub(r'\s+', '-', (property_code or '').strip()).upper()
    house_part = re.sub(r'\s+', '-', (house_name or '').strip()).upper()
    if prop_part and house_part:
        prefix = f"{prop_part}-"
        if house_part.startswith(prefix):
            house_part = house_part[len(prefix):]
        return f"{prop_part}-{house_part}"[:50]
    return (house_part or prop_part)[:50]


class Unit(models.Model):
    unit_no = models.CharField(max_length=50)
    unit_name = models.CharField(max_length=100)
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='units')
    
    rent_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    deposit = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    security_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    electricity_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    internet_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    garbage_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    water_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    unit_type = models.CharField(max_length=50, default='Single Room', blank=True, null=True)
    category = models.CharField(max_length=50, default='Residential', blank=True, null=True)
    status = models.CharField(max_length=30, default='active', blank=True, null=True)
    
    is_occupied = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['property', 'unit_no'],
                name='unique_unit_number_per_property',
            ),
            models.CheckConstraint(
                condition=~models.Q(unit_no=''),
                name='unit_number_not_blank',
            ),
        ]

    def save(self, *args, **kwargs):
        self.unit_name = (self.unit_name or '').strip()
        prop_code = ''
        if self.property_id:
            prop_obj = getattr(self, '_property_cache', None)
            if prop_obj is None or prop_obj.pk != self.property_id:
                prop_obj = Property.objects.filter(pk=self.property_id).only('property_id').first()
            if prop_obj:
                prop_code = prop_obj.property_id

        if self.unit_name and prop_code:
            self.unit_no = build_unit_smart_alias(prop_code, self.unit_name)
        elif self.unit_no:
            self.unit_no = re.sub(r'\s+', '-', str(self.unit_no).strip()).upper()[:50]
        elif self.unit_name:
            self.unit_no = re.sub(r'\s+', '-', self.unit_name).upper()[:50]
        else:
            self.unit_no = ''

        if not self.unit_no:
            raise ValueError('Unit number / smart alias cannot be blank.')
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.property.name} - Unit {self.unit_name} ({self.unit_no})"


class UnitOption(models.Model):
    KIND_CHOICES = [
        ('type', 'Unit type'),
        ('category', 'Unit category'),
    ]

    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    name = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['kind', 'name']
        constraints = [
            models.UniqueConstraint(fields=['kind', 'name'], name='unique_unit_option_kind_name'),
        ]

    def save(self, *args, **kwargs):
        self.name = (self.name or '').strip()
        if not self.name:
            raise ValueError('Unit option name cannot be blank.')
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_kind_display()}: {self.name}"


class MpesaTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mpesa_receipt_number = models.CharField(max_length=50, unique=True)
    transaction_type = models.CharField(max_length=20, default='c2b')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    phone_number = models.CharField(max_length=20)
    account_reference = models.CharField(max_length=100, blank=True, null=True)
    transaction_date = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name='ledger_transaction_amount_positive',
            ),
        ]

    def __str__(self):
        return f"{self.mpesa_receipt_number} - {self.amount}"


class PaymentAllocation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(
        'billing.Invoice', 
        on_delete=models.CASCADE, 
        related_name='allocations',
        null=True, blank=True
    )
    mpesa_transaction = models.ForeignKey(
        MpesaTransaction, 
        on_delete=models.CASCADE, 
        related_name='allocations'
    )
    amount_allocated = models.DecimalField(max_digits=12, decimal_places=2)
    allocated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-allocated_at']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount_allocated__gt=0),
                name='payment_allocation_amount_positive',
            ),
        ]

    def __str__(self):
        return f"Allocation: {self.amount_allocated}"


PropertyUnit = Unit

__all__ = [
    'Landlord', 'Property', 'PropertyAgreement', 'Unit', 'UnitOption',
    'PropertyUnit', 'MpesaTransaction', 'PaymentAllocation',
]