from django.db import migrations, models


def populate_smart_aliases(apps, schema_editor):
    Tenant = apps.get_model('tenants', 'Tenant')
    database = schema_editor.connection.alias
    tenants = Tenant.objects.using(database).select_related(
        'unit__property'
    ).filter(unit__isnull=False)

    for tenant in tenants.iterator():
        property_number = (tenant.unit.property.property_id or '').strip().upper()
        house_number = (tenant.unit.unit_no or '').strip().upper()
        tenant.smart_alias = (
            f'{property_number}-{house_number}'
            if property_number and house_number else ''
        )
        tenant.save(update_fields=['smart_alias'], using=database)


class Migration(migrations.Migration):

    dependencies = [
        ('properties', '0001_initial'),
        ('tenants', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenant',
            name='smart_alias',
            field=models.CharField(blank=True, db_index=True, default='', max_length=100),
        ),
        migrations.RunPython(populate_smart_aliases, migrations.RunPython.noop),
    ]
