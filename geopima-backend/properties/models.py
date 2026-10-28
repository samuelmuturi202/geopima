import uuid
from django.db import models
from django.utils import timezone


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

    def __str__(self):
        return self.name


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

    def __str__(self):
        return f"{self.property.name} - Unit {self.unit_name}"


class MpesaTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mpesa_receipt_number = models.CharField(max_length=50, unique=True)
    transaction_type = models.CharField(max_length=20, default='c2b')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    phone_number = models.CharField(max_length=20)
    account_reference = models.CharField(max_length=50, blank=True, null=True)
    transaction_date = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

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

    def __str__(self):
        return f"Allocation: {self.amount_allocated}"


PropertyUnit = Unit

__all__ = ['Landlord', 'Property', 'Unit', 'PropertyUnit', 'MpesaTransaction', 'PaymentAllocation']