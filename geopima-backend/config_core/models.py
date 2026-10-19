from django.db import models
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver


class AgencyProfile(models.Model):
    TRANSITION_CHOICES = [
        ('auto', 'Automatically transition to new month'),
        ('manual', 'Manual transition'),
    ]

    company_name = models.CharField(max_length=255, default="Pemwa Agency")
    short_name = models.CharField(max_length=50, blank=True, null=True)
    motto_slogan = models.CharField(max_length=255, default='"Your Comfort Our Concern"')
    contact = models.CharField(max_length=20)
    contact_2 = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField()
    physical_address = models.TextField()
    postal_address = models.CharField(max_length=255)
    website = models.URLField(blank=True, null=True)
    end_month_transition = models.CharField(
        max_length=10, choices=TRANSITION_CHOICES, default='auto'
    )
    logo = models.ImageField(upload_to='agency_logos/', blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.company_name


class UserRole(models.Model):
    name = models.CharField(max_length=50, unique=True)
    permissions = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    # Changed related_name to 'profile_holders' to avoid any clash with other models
    role = models.ForeignKey(UserRole, on_delete=models.SET_NULL, null=True, blank=True, related_name='profile_holders')
    phone = models.CharField(max_length=20, blank=True, null=True)
    position = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        role_name = self.role.name if self.role else 'No Role'
        return f"{self.user.username} - {role_name}"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
    elif hasattr(instance, 'profile'):
        instance.profile.save()


class PaymentBank(models.Model):
    short_name = models.CharField(max_length=50)
    long_name = models.CharField(max_length=100)
    branch = models.CharField(max_length=100)
    acc_name = models.CharField(max_length=100)
    business_no = models.CharField(max_length=50, blank=True, null=True)
    acc_number = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)
    on_invoice = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.short_name} - {self.acc_number}"


class SMSTemplate(models.Model):
    CATEGORY_CHOICES = [
        ('FEE_REMINDER', 'Fee Reminder'),
        ('PAYMENT_NOTIF', 'Payment Notification'),
        ('DISCOUNT', 'Discount'),
        ('WELCOME', 'New Tenant Welcome'),
    ]

    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, unique=True)
    template_text = models.TextField()
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.get_category_display()


class AgreementTemplate(models.Model):
    TYPE_CHOICES = [
        ('Residential Lease', 'Residential Lease'),
        ('Commercial Lease', 'Commercial Lease'),
        ('Tenancy Agreement', 'Tenancy Agreement'),
        ('Sublease Agreement', 'Sublease Agreement'),
    ]

    name = models.CharField(max_length=255)
    agreement_type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    content = models.TextField(blank=True, null=True)

    def save(self, *args, **kwargs):
        if self.is_default:
            AgreementTemplate.objects.filter(
                agreement_type=self.agreement_type, is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name