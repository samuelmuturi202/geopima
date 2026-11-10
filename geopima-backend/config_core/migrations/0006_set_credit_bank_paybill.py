from django.db import migrations, models


def update_credit_bank_paybill(apps, schema_editor):
    database = schema_editor.connection.alias
    CreditBankConfig = apps.get_model('config_core', 'CreditBankConfig')
    PaymentBank = apps.get_model('config_core', 'PaymentBank')

    CreditBankConfig.objects.using(database).filter(
        paybill_number='4045619'
    ).update(paybill_number='6775')
    CreditBankConfig.objects.using(database).get_or_create(
        pk=1,
        defaults={
            'paybill_number': '6775',
            'client_id': '',
            'secret_key': '',
            'signing_key': '',
            'is_live': False,
        },
    )
    PaymentBank.objects.using(database).filter(
        bank_type='smart_alias'
    ).update(business_no='6775')
    if not PaymentBank.objects.using(database).filter(
        bank_type='smart_alias'
    ).exists():
        PaymentBank.objects.using(database).create(
            short_name='Credit Bank',
            long_name='Credit Bank Smart Alias',
            acc_name='Tenant Payments',
            business_no='6775',
            acc_number='Tenant Smart Alias',
            bank_type='smart_alias',
            is_active=True,
            on_invoice=True,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('config_core', '0005_seed_communication_setup'),
    ]

    operations = [
        migrations.AlterField(
            model_name='creditbankconfig',
            name='paybill_number',
            field=models.CharField(default='6775', max_length=50),
        ),
        migrations.RunPython(update_credit_bank_paybill, migrations.RunPython.noop),
    ]
