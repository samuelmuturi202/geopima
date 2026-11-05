import django.conf
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0002_initial'),
        ('properties', '0001_initial'),
        migrations.swappable_dependency(django.conf.settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CommunicationDraft',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('recipient_type', models.CharField(choices=[('tenant', 'Tenant'), ('landlord', 'Landlord')], max_length=10)),
                ('recipient_name', models.CharField(max_length=255)),
                ('phone_number', models.CharField(max_length=20)),
                ('reminder_type', models.CharField(choices=[('rent_due', 'Rent due soon'), ('rent_overdue', 'Overdue rent'), ('landlord_monthly', 'Monthly landlord update')], max_length=20)),
                ('message', models.TextField()),
                ('status', models.CharField(choices=[('pending', 'Pending approval'), ('approved', 'Approved')], default='pending', max_length=10)),
                ('period', models.DateField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_communication_drafts', to=django.conf.settings.AUTH_USER_MODEL)),
                ('invoice', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='communication_drafts', to='billing.invoice')),
                ('landlord', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='communication_drafts', to='properties.landlord')),
            ],
            options={
                'ordering': ['-created_at'],
                'constraints': [
                    models.UniqueConstraint(condition=models.Q(('invoice__isnull', False)), fields=('invoice', 'reminder_type'), name='uniq_com_draft_invoice_type'),
                    models.UniqueConstraint(condition=models.Q(('landlord__isnull', False), ('period__isnull', False)), fields=('landlord', 'reminder_type', 'period'), name='uniq_com_draft_landlord_period'),
                ],
            },
        ),
    ]
