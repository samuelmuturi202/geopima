import datetime
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from tenants.models import LeaseAgreement
from billing.models import Invoice, InvoiceItem


class Command(BaseCommand):
    help = 'Generates monthly invoices with dynamic rent, water, garbage, and deposits matching the Invoice model schema.'

    def handle(self, *args, **options):
        today = timezone.now().date()
        billing_period = datetime.date(today.year, today.month, 1)
        due_date = datetime.date(today.year, today.month, 5)

        active_agreements = LeaseAgreement.objects.filter(
            is_active=True
        ).select_related('tenant', 'unit', 'unit__property')
        
        created_count = 0

        for agreement in active_agreements:
            tenant = agreement.tenant
            unit = agreement.unit

            if not unit:
                continue

            # Prevent duplicate billing for the current billing period
            if Invoice.objects.filter(tenant=tenant, unit=unit, billing_period=billing_period).exists():
                continue

            with transaction.atomic():
                invoice = Invoice.objects.create(
                    tenant=tenant,
                    unit=unit,
                    billing_period=billing_period,
                    due_date=due_date,
                    status='unpaid'
                )

                # 1. Base Rent
                if getattr(unit, 'rent_amount', 0) > 0:
                    InvoiceItem.objects.create(
                        invoice=invoice,
                        item_type='Rent',
                        description='Base Rent',
                        amount=unit.rent_amount
                    )

                # 2. Water Utility Fee
                if getattr(unit, 'water_rate', 0) > 0:
                    InvoiceItem.objects.create(
                        invoice=invoice,
                        item_type='Utility',
                        description='Water Utility Fee',
                        amount=unit.water_rate
                    )

                # 3. Garbage Collection Fee
                if getattr(unit, 'garbage_fee', 0) > 0:
                    InvoiceItem.objects.create(
                        invoice=invoice,
                        item_type='Utility',
                        description='Garbage Collection',
                        amount=unit.garbage_fee
                    )

                # 4. Deposit (If applicable on initial creation)
                if getattr(agreement, 'deposit_amount', 0) > 0:
                    InvoiceItem.objects.create(
                        invoice=invoice,
                        item_type='Deposit',
                        description='Lease Security Deposit',
                        amount=agreement.deposit_amount
                    )

                created_count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully generated {created_count} monthly invoice(s) for billing period {billing_period.strftime('%B-%Y')}."))