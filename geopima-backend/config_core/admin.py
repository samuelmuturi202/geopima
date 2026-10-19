from django.contrib import admin
from .models import AgencyProfile, UserRole, PaymentBank, SMSTemplate, AgreementTemplate

@admin.register(AgencyProfile)
class AgencyProfileAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'email', 'contact', 'end_month_transition', 'updated_at')

@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ('name',)

@admin.register(PaymentBank)
class PaymentBankAdmin(admin.ModelAdmin):
    list_display = ('short_name', 'long_name', 'acc_number', 'is_active', 'on_invoice')
    list_filter = ('is_active', 'on_invoice')

@admin.register(SMSTemplate)
class SMSTemplateAdmin(admin.ModelAdmin):
    list_display = ('category', 'updated_at')

@admin.register(AgreementTemplate)
class AgreementTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'agreement_type', 'is_default', 'is_active')
    list_filter = ('agreement_type', 'is_default', 'is_active')