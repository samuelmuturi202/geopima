import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

from config_core.models import AgreementTemplate, UserRole
from properties.models import Unit
from .utils import normalize_phone_number


class User(AbstractUser):
    phone = models.CharField(max_length=17, blank=True, null=True)
    roles = models.ManyToManyField(UserRole, related_name='users', blank=True)
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if self.phone:
            self.phone = normalize_phone_number(self.phone)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.get_full_name() or self.username


class Tenant(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('vacated', 'Vacated'),
        ('suspended', 'Suspended'),
    ]

    user = models.OneToOneField(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='tenant_profile'
    )
    tenant_id = models.CharField(max_length=20, unique=True, blank=True)
    name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, null=True, blank=True, related_name='tenants')
    entry_date = models.DateField(default=timezone.now)
    due_date = models.PositiveIntegerField(default=5)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    def save(self, *args, **kwargs):
        if not self.tenant_id:
            self.tenant_id = f"PROP-{uuid.uuid4().hex[:8].upper()}"
        if self.phone_number:
            self.phone_number = normalize_phone_number(self.phone_number)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.tenant_id} - {self.name}"


class LeaseAgreement(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='agreements')
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name='agreements')
    template = models.ForeignKey(
        AgreementTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name='leases'
    )
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    rent_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)
    agreement_file = models.FileField(upload_to='lease_agreements/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Lease: {self.tenant.name} -> {self.unit.unit_name}"