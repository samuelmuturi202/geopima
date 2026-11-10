import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

from properties.models import Unit
from .utils import build_smart_alias, normalize_phone_number


class User(AbstractUser):
    phone = models.CharField(max_length=17, blank=True, null=True)
    # Use string reference for cross-app ManyToManyField
    roles = models.ManyToManyField('config_core.UserRole', related_name='users', blank=True)
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
    tenant_id = models.CharField(max_length=20, primary_key=True, unique=True, blank=True)
    name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, null=True, blank=True, related_name='tenants')
    smart_alias = models.CharField(max_length=100, blank=True, default='', db_index=True)
    entry_date = models.DateField(default=timezone.now)
    due_date = models.PositiveIntegerField(default=5)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    def save(self, *args, **kwargs):
        if not self.tenant_id:
            self.tenant_id = f"PROP-{uuid.uuid4().hex[:8].upper()}"
        if self.phone_number:
            self.phone_number = normalize_phone_number(self.phone_number)
        update_fields = kwargs.get('update_fields')
        if update_fields is not None:
            update_fields = set(update_fields)
            if self.pk and 'unit' not in update_fields and 'unit_id' not in update_fields:
                self.unit_id = type(self).objects.values_list(
                    'unit_id', flat=True
                ).get(pk=self.pk)
            kwargs['update_fields'] = set(update_fields) | {'smart_alias'}

        if self.unit_id:
            unit = Unit.objects.select_related('property').get(pk=self.unit_id)
            self.smart_alias = build_smart_alias(
                unit.property.property_id,
                unit.unit_no,
            )
        else:
            self.smart_alias = ''
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.tenant_id} - {self.name}"


class LeaseAgreement(models.Model):
    tenant = models.ForeignKey(Tenant, to_field='tenant_id', on_delete=models.CASCADE, related_name='agreements')
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name='agreements')
    # Use string reference for cross-app ForeignKey
    template = models.ForeignKey(
        'config_core.AgreementTemplate', on_delete=models.SET_NULL, null=True, blank=True, related_name='leases'
    )
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    rent_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)
    agreement_file = models.FileField(upload_to='lease_agreements/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self._state.adding or self._relationship_changed('tenant_id', 'unit_id'):
            if not Tenant.objects.filter(
                tenant_id=self.tenant_id,
                unit_id=self.unit_id,
            ).exists():
                raise ValueError('Lease tenant must be assigned to the lease unit.')
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
        return f"Lease: {self.tenant.name} -> {self.unit.unit_name}"