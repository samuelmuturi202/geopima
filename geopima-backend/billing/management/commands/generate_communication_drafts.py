from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.utils.dateparse import parse_date

from billing.communication import generate_communication_drafts


class Command(BaseCommand):
    help = 'Create due-date, overdue, and month-start landlord SMS drafts.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            help='Run for a specific local date (YYYY-MM-DD), primarily for backfills.',
        )

    def handle(self, *args, **options):
        run_date = parse_date(options['date']) if options['date'] else timezone.localdate()
        if run_date is None:
            raise CommandError('--date must use YYYY-MM-DD format.')

        result = generate_communication_drafts(run_date=run_date)
        self.stdout.write(self.style.SUCCESS(
            f"Created {result['created']} draft(s) for {run_date}; "
            f"refreshed {result['updated']} pending draft(s); "
            f"skipped {result['skipped_no_phone']} recipient(s) without a phone number."
        ))
