from django.db import migrations


FORWARD_SQL = """
CREATE OR REPLACE FUNCTION geopima_validate_invoice_tenant_unit()
RETURNS trigger AS $$
DECLARE
    tenant_unit_id bigint;
BEGIN
    IF TG_OP = 'UPDATE'
       AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id
       AND NEW.unit_id IS NOT DISTINCT FROM OLD.unit_id THEN
        RETURN NEW;
    END IF;

    SELECT unit_id INTO tenant_unit_id
      FROM tenants_tenant
     WHERE tenant_id = NEW.tenant_id;
    IF tenant_unit_id IS DISTINCT FROM NEW.unit_id THEN
        RAISE EXCEPTION 'Invoice tenant must be assigned to the invoice unit.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_invoice_tenant_unit_before_write
BEFORE INSERT OR UPDATE OF tenant_id, unit_id ON billing_invoice
FOR EACH ROW EXECUTE FUNCTION geopima_validate_invoice_tenant_unit();

CREATE OR REPLACE FUNCTION geopima_validate_invoice_item_total()
RETURNS trigger AS $$
DECLARE
    invoice_total numeric(14, 2);
    allocated_total numeric(14, 2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM id FROM billing_invoice WHERE id = OLD.invoice_id FOR UPDATE;
        SELECT COALESCE(SUM(amount), 0) - OLD.amount
          INTO invoice_total
          FROM billing_invoiceitem
         WHERE invoice_id = OLD.invoice_id;
        SELECT COALESCE(SUM(amount_allocated), 0)
          INTO allocated_total
          FROM properties_paymentallocation
         WHERE invoice_id = OLD.invoice_id;
        IF allocated_total > invoice_total THEN
            RAISE EXCEPTION 'Invoice items cannot be reduced below its allocated payments.';
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN
        PERFORM id FROM billing_invoice WHERE id = OLD.invoice_id FOR UPDATE;
        SELECT COALESCE(SUM(amount), 0) - OLD.amount
          INTO invoice_total
          FROM billing_invoiceitem
         WHERE invoice_id = OLD.invoice_id;
        SELECT COALESCE(SUM(amount_allocated), 0)
          INTO allocated_total
          FROM properties_paymentallocation
         WHERE invoice_id = OLD.invoice_id;
        IF allocated_total > invoice_total THEN
            RAISE EXCEPTION 'Invoice items cannot be moved below its allocated payments.';
        END IF;
    END IF;

    PERFORM id FROM billing_invoice WHERE id = NEW.invoice_id FOR UPDATE;
    IF TG_OP = 'UPDATE' THEN
        SELECT COALESCE(SUM(amount), 0) + NEW.amount
          INTO invoice_total
          FROM billing_invoiceitem
         WHERE invoice_id = NEW.invoice_id
           AND id <> OLD.id;
    ELSE
        SELECT COALESCE(SUM(amount), 0) + NEW.amount
          INTO invoice_total
          FROM billing_invoiceitem
         WHERE invoice_id = NEW.invoice_id;
    END IF;
    SELECT COALESCE(SUM(amount_allocated), 0)
      INTO allocated_total
      FROM properties_paymentallocation
     WHERE invoice_id = NEW.invoice_id;

    IF allocated_total > invoice_total THEN
        RAISE EXCEPTION 'Invoice items cannot be reduced below its allocated payments.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_invoice_item_total_before_write
BEFORE INSERT OR UPDATE OR DELETE ON billing_invoiceitem
FOR EACH ROW EXECUTE FUNCTION geopima_validate_invoice_item_total();
"""


REVERSE_SQL = """
DROP TRIGGER IF EXISTS geopima_invoice_item_total_before_write ON billing_invoiceitem;
DROP FUNCTION IF EXISTS geopima_validate_invoice_item_total();
DROP TRIGGER IF EXISTS geopima_invoice_tenant_unit_before_write ON billing_invoice;
DROP FUNCTION IF EXISTS geopima_validate_invoice_tenant_unit();
"""


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0006_alter_invoice_unique_together_and_more'),
        ('properties', '0004_property_property_id_not_blank'),
        ('tenants', '0003_smart_alias_database_integrity'),
    ]

    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
    ]
