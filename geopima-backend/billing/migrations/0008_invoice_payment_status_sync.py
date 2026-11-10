from django.db import migrations


FORWARD_SQL = """
CREATE OR REPLACE FUNCTION geopima_refresh_invoice_payment_status(invoice_uuid uuid)
RETURNS void AS $$
DECLARE
    invoice_total numeric(14, 2);
    amount_paid numeric(14, 2);
    invoice_due_date date;
    current_status varchar(20);
    next_status varchar(20);
BEGIN
    SELECT
        (SELECT COALESCE(SUM(amount), 0)
           FROM billing_invoiceitem
          WHERE invoice_id = invoice_uuid),
        (SELECT COALESCE(SUM(amount_allocated), 0)
           FROM properties_paymentallocation
          WHERE invoice_id = invoice_uuid),
        due_date,
        status
      INTO invoice_total, amount_paid, invoice_due_date, current_status
      FROM billing_invoice
     WHERE id = invoice_uuid
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF invoice_total > 0 AND amount_paid >= invoice_total THEN
        next_status := 'paid';
    ELSIF amount_paid > 0 THEN
        next_status := 'partially_paid';
    ELSIF current_status = 'overdue' OR invoice_due_date < CURRENT_DATE THEN
        next_status := 'overdue';
    ELSE
        next_status := 'unpaid';
    END IF;

    IF current_status IS DISTINCT FROM next_status THEN
        UPDATE billing_invoice SET status = next_status WHERE id = invoice_uuid;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION geopima_invoice_payment_status_after_change()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN
        PERFORM geopima_refresh_invoice_payment_status(OLD.invoice_id);
    END IF;
    IF TG_OP = 'DELETE' THEN
        PERFORM geopima_refresh_invoice_payment_status(OLD.invoice_id);
    ELSE
        PERFORM geopima_refresh_invoice_payment_status(NEW.invoice_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_invoice_item_payment_status_after_change
AFTER INSERT OR UPDATE OR DELETE ON billing_invoiceitem
FOR EACH ROW EXECUTE FUNCTION geopima_invoice_payment_status_after_change();

CREATE TRIGGER geopima_payment_allocation_status_after_change
AFTER INSERT OR UPDATE OR DELETE ON properties_paymentallocation
FOR EACH ROW EXECUTE FUNCTION geopima_invoice_payment_status_after_change();

DO $$
DECLARE
    invoice_row record;
BEGIN
    FOR invoice_row IN SELECT id FROM billing_invoice LOOP
        PERFORM geopima_refresh_invoice_payment_status(invoice_row.id);
    END LOOP;
END;
$$;
"""


REVERSE_SQL = """
DROP TRIGGER IF EXISTS geopima_payment_allocation_status_after_change ON properties_paymentallocation;
DROP TRIGGER IF EXISTS geopima_invoice_item_payment_status_after_change ON billing_invoiceitem;
DROP FUNCTION IF EXISTS geopima_invoice_payment_status_after_change();
DROP FUNCTION IF EXISTS geopima_refresh_invoice_payment_status(uuid);
"""


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0007_invoice_relationship_and_item_integrity'),
        ('properties', '0005_payment_allocation_database_integrity'),
    ]

    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
    ]
