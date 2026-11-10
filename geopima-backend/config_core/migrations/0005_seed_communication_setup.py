from django.db import migrations, models


DEFAULT_TEMPLATES = {
    'FEE_REMINDER': (
        'Dear {tenant}, your rent balance of KES {balance} for {month} is due '
        'on {due_date}. Pay via Paybill {paybill}, account {tnt}.'
    ),
    'PAYMENT_NOTIF': (
        'Dear {tenant}, we received KES {paid} for {unit}. Receipt {receiptno}. '
        'Your balance is KES {balance}. Thank you.'
    ),
    'DISCOUNT': (
        'Dear {tenant}, a KES {discount} discount was applied for {month}. '
        'Your balance is KES {balance}.'
    ),
    'WELCOME': (
        'Welcome {tenant} to {agency}. Your unit is {unit}. '
        'Contact us if you need assistance.'
    ),
    'LANDLORD_UPDATE': (
        'Hello {landlord}, your {month} rent summary: KES {expected} expected, '
        'KES {collected} collected, KES {outstanding} outstanding.'
    ),
}


def seed_communication_setup(apps, schema_editor):
    MessengerConfig = apps.get_model('config_core', 'MessengerConfig')
    SMSTemplate = apps.get_model('config_core', 'SMSTemplate')

    MessengerConfig.objects.using(schema_editor.connection.alias).get_or_create(
        pk=1,
        defaults={
            'service_provider': 'Celcom Africa',
            'sender_id': '',
            'partner_id': '',
            'partner_key': '',
            'agency_phone': '',
            'notify_tenant': True,
        },
    )
    for category, template_text in DEFAULT_TEMPLATES.items():
        SMSTemplate.objects.using(schema_editor.connection.alias).get_or_create(
            category=category,
            defaults={'template_text': template_text},
        )


class Migration(migrations.Migration):

    dependencies = [
        ('config_core', '0004_alter_messengerconfig_service_provider'),
    ]

    operations = [
        migrations.AlterField(
            model_name='messengerconfig',
            name='sender_id',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.RunPython(seed_communication_setup, migrations.RunPython.noop),
    ]
