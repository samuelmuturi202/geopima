from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('properties', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='mpesatransaction',
            name='account_reference',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]
