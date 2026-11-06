import calendar
import re
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import CommunicationDraft, Invoice


REMINDER_DAYS_BEFORE_DUE = 5


def _previous_month_start(run_date):
    if run_date.month == 1:
        return date(run_date.year - 1, 12, 1)
    return date(run_date.year, run_date.month - 1, 1)


def _render_template(template, values):
    return re.sub(
        r'\{([a-zA-Z0-9_]+)\}',
        lambda match: str(values.get(match.group(1), match.group(0))),
        template,
    )


def _tenant_message(invoice, reminder_type, agency_name, paybill, fee_template):
    balance = invoice.balance
    month = invoice.period_formatted
    uses_custom_template = bool(fee_template)
    if fee_template:
        template = fee_template
    elif reminder_type == 'rent_due':
        template = (
            'Dear {tenant}, your rent balance of KES {balance} for {month} '
            'is due on {due_date}.'
        )
    else:
        template = (
            'Dear {tenant}, your rent balance of KES {balance} for {month} '
            'is overdue (due {due_date}). Please contact {agency} if you have paid.'
        )

    message = _render_template(template, {
        'tenant': invoice.tenant.name,
        'balance': f'{balance:,.2f}',
        'tnt': invoice.tenant.tenant_id,
        'paybill': paybill or 'contact the office',
        'agency': agency_name,
        'month': month,
        'due_date': invoice.due_date.strftime('%d %b %Y'),
        'unit': invoice.unit.unit_name,
    })
    if uses_custom_template:
        if reminder_type == 'rent_due':
            notice = 'This rent is due soon.'
            if '{due_date}' not in template:
                notice += f" Please pay by {invoice.due_date.strftime('%d %b %Y')}."
        else:
            notice = 'This rent is overdue.'
            if '{due_date}' not in template:
                notice += f" It was due on {invoice.due_date.strftime('%d %b %Y')}."
        message = f'{message} {notice}'
    return message


def _draft_tenant_reminders(run_date, created_by, totals):
    from config_core.models import AgencyProfile, PaymentBank, SMSTemplate

    agency_name = AgencyProfile.objects.values_list('company_name', flat=True).first() or 'the management office'
    paybill = PaymentBank.objects.filter(
        bank_type='mpesa', is_active=True
    ).exclude(business_no='').values_list('business_no', flat=True).first() or ''
    fee_template = SMSTemplate.objects.filter(
        category='FEE_REMINDER'
    ).values_list('template_text', flat=True).first()

    invoices = Invoice.objects.filter(
        Q(due_date__lte=run_date)
        | Q(due_date=run_date + timedelta(days=REMINDER_DAYS_BEFORE_DUE)),
        tenant__status='active',
    ).select_related(
        'tenant', 'unit', 'unit__property'
    ).prefetch_related('items', 'allocations').order_by('due_date')

    for invoice in invoices:
        if invoice.balance <= Decimal('0.00'):
            continue

        if invoice.due_date == run_date + timedelta(days=REMINDER_DAYS_BEFORE_DUE):
            reminder_type = 'rent_due'
        elif invoice.due_date < run_date:
            reminder_type = 'rent_overdue'
        else:
            continue

        if not invoice.tenant.phone_number:
            totals['skipped_no_phone'] += 1
            continue

        message = _tenant_message(
            invoice, reminder_type, agency_name, paybill, fee_template
        )
        draft, created = CommunicationDraft.objects.get_or_create(
            invoice=invoice,
            reminder_type=reminder_type,
            defaults={
                'recipient_type': 'tenant',
                'recipient_name': invoice.tenant.name,
                'phone_number': invoice.tenant.phone_number,
                'message': message,
                'created_by': created_by,
            },
        )
        totals['created'] += int(created)
        if not created and draft.status == 'pending':
            changed_fields = []
            for field, value in (
                ('recipient_name', invoice.tenant.name),
                ('phone_number', invoice.tenant.phone_number),
                ('message', message),
            ):
                if getattr(draft, field) != value:
                    setattr(draft, field, value)
                    changed_fields.append(field)
            if changed_fields:
                draft.save(update_fields=[*changed_fields, 'updated_at'])
                totals['updated'] += 1


def _draft_landlord_summaries(run_date, created_by, totals, force=False):
    if run_date.day != 1 and not force:
        return

    from config_core.models import AgencyProfile, SMSTemplate
    from properties.models import Landlord

    period = _previous_month_start(run_date)
    last_day = calendar.monthrange(period.year, period.month)[1]
    agency_name = AgencyProfile.objects.values_list('company_name', flat=True).first() or 'the management office'
    template = SMSTemplate.objects.filter(
        category='LANDLORD_UPDATE'
    ).values_list('template_text', flat=True).first()
    invoices = Invoice.objects.filter(
        billing_period__range=(period, date(period.year, period.month, last_day)),
        unit__property__landlord__is_active=True,
    ).select_related(
        'tenant', 'unit__property__landlord'
    ).prefetch_related('items', 'allocations')

    summaries = defaultdict(lambda: {
        'expected': Decimal('0.00'),
        'collected': Decimal('0.00'),
        'outstanding': Decimal('0.00'),
    })
    for invoice in invoices:
        landlord = invoice.unit.property.landlord
        summary = summaries[landlord.pk]
        summary['expected'] += invoice.net_total
        summary['collected'] += invoice.rent_paid
        summary['outstanding'] += max(invoice.balance, Decimal('0.00'))

    landlords = Landlord.objects.in_bulk(summaries.keys())
    for landlord_id, summary in summaries.items():
        landlord = landlords[landlord_id]
        if not landlord.phone_number:
            totals['skipped_no_phone'] += 1
            continue

        values = {
            'landlord': landlord.name,
            'agency': agency_name,
            'month': period.strftime('%B %Y'),
            'expected': f"{summary['expected']:,.2f}",
            'collected': f"{summary['collected']:,.2f}",
            'outstanding': f"{summary['outstanding']:,.2f}",
        }
        message = _render_template(
            template or (
                'Hello {landlord}, your {month} rent summary: '
                'KES {expected} expected, KES {collected} collected, '
                'KES {outstanding} outstanding.'
            ),
            values,
        )
        draft, created = CommunicationDraft.objects.get_or_create(
            landlord=landlord,
            reminder_type='landlord_monthly',
            period=period,
            defaults={
                'recipient_type': 'landlord',
                'recipient_name': landlord.name,
                'phone_number': landlord.phone_number,
                'message': message,
                'created_by': created_by,
            },
        )
        totals['created'] += int(created)
        if not created and draft.status == 'pending':
            changed_fields = []
            for field, value in (
                ('recipient_name', landlord.name),
                ('phone_number', landlord.phone_number),
                ('message', message),
            ):
                if getattr(draft, field) != value:
                    setattr(draft, field, value)
                    changed_fields.append(field)
            if changed_fields:
                draft.save(update_fields=[*changed_fields, 'updated_at'])
                totals['updated'] += 1


@transaction.atomic
def generate_communication_drafts(run_date=None, created_by=None, include_landlord_summaries=False):
    run_date = run_date or timezone.localdate()
    totals = {'created': 0, 'updated': 0, 'skipped_no_phone': 0}
    _draft_tenant_reminders(run_date, created_by, totals)
    _draft_landlord_summaries(
        run_date, created_by, totals, force=include_landlord_summaries
    )
    return totals
