from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from config_core.models import UserProfile

class Command(BaseCommand):
    help = 'Cleans up duplicate user profiles'

    def handle(self, *args, **options):
        for user in User.objects.all():
            profiles = UserProfile.objects.filter(user=user)
            if profiles.count() > 1:
                self.stdout.write(f"Cleaning duplicates for user: {user.username}")
                first_profile = profiles.first()
                profiles.exclude(id=first_profile.id).delete()
        self.stdout.write(self.style.SUCCESS("Successfully cleaned duplicate user profiles!"))