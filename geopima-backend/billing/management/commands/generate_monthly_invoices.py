from datetime import date
from django.core.management.base import BaseCommand
from django.db import transaction
from tenants.models import LeaseAgreement
from billing.models import Invoice, InvoiceItem


class Command(BaseCommand):
    help = 'Generates monthly invoices with dynamic deposits, rent, water, and garbage fees.'

    def handle(self, *args, **options):
        today = date.today()
        period_str = today.strftime("%B-%Y").upper()

        active_agreements = LeaseAgreement.objects.filter(
            is_active=True
        ).select_related('tenant', 'unit', 'unit__property')
        
        created_count = 0

        for agreement in active_agreements:
            tenant = agreement.tenant
            unit = agreement.unit

            if not unit:
                continue

            # Prevent duplicate billing for the current month
            if Invoice.objects.filter(tenant=tenant, period=period_str).exists():
                continue

            with transaction.atomic():
                # Fetch last invoice balance to carry forward as arrears
                last_invoice = Invoice.objects.filter(tenant=tenant).order_by('-created_at').first()
                previous_arrears = last_invoice.balance if last_invoice else 0.00

                invoice_no = f"INV-{tenant.id}-{today.strftime('%Y%m%d%H%M')}"
                invoice = Invoice.objects.create(
                    invoice_no=invoice_no,
                    tenant=tenant,
                    period=period_str,
                    arrears_amount=previous_arrears,
                    status='UNPAID'
                )

                expected_total = 0.00

                # 1. Base Rent
                if unit.rent_amount > 0:
                    InvoiceItem.objects.create(
                        invoice=invoice,
                        description="Base Rent",
                        amount=unit.rent_amount
                    )
                    expected_total += unit.rent_amount

                # 2. Water Utility Fee
                if unit.water_rate > 0:
                    InvoiceItem.objects.create(
                        invoice=invoice,
                        description="Water Utility Fee",
                        amount=unit.water_rate
                    )
                    expected_total += unit.water_rate

                # 3. Garbage Collection Fee
                if unit.garbage_fee > 0:
                    InvoiceItem.objects.create(
                        invoice=invoice,
                        description="Garbage Collection",
                        amount=unit.garbage_fee
                    )
                    expected_total += unit.garbage_fee

                # 4. Deposit (Initial Invoice for Lease Agreement)
                if agreement.deposit_amount > 0:
                    InvoiceItem.objects.create(
                        invoice=invoice,
                        description="Lease Security Deposit",
                        amount=agreement.deposit_amount
                    )
                    expected_total += agreement.deposit_amount

                invoice.expected_amount = expected_total
                invoice.save()
                created_count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully generated {created_count} monthly invoice(s) for period {period_str}."))