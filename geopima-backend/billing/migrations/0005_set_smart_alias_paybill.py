from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0004_communicationdraft_provider_message_id_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='smartaliastransaction',
            name='paybill_number',
            field=models.CharField(default='6775', max_length=50),
        ),
    ]
