from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('mpesa', '0003_paymentsettlement_receipt_number_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='mpesatransaction',
            name='source',
            field=models.CharField(
                choices=[
                    ('mpesa', 'M-Pesa'),
                    ('credit_bank', 'Credit Bank'),
                    ('manual', 'Manual'),
                ],
                default='mpesa',
                max_length=20,
            ),
        ),
    ]
