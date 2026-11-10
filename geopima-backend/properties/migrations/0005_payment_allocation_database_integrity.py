from django.db import migrations


FORWARD_SQL = """
CREATE OR REPLACE FUNCTION geopima_validate_payment_allocation()
RETURNS trigger AS $$
DECLARE
    old_invoice_id uuid;
    transaction_amount numeric(14, 2);
    transaction_allocated numeric(14, 2);
    invoice_total numeric(14, 2);
    invoice_allocated numeric(14, 2);
BEGIN
    IF TG_OP = 'UPDATE' THEN
        old_invoice_id := OLD.invoice_id;
    END IF;

    PERFORM id
      FROM billing_invoice
     WHERE id = NEW.invoice_id OR id = old_invoice_id
     ORDER BY id
     FOR UPDATE;

    SELECT amount INTO transaction_amount
      FROM properties_mpesatransaction
     WHERE id = NEW.mpesa_transaction_id
     FOR UPDATE;
    IF transaction_amount IS NULL THEN
        RAISE EXCEPTION 'Payment allocation requires a valid transaction.';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        SELECT COALESCE(SUM(amount_allocated), 0)
          INTO transaction_allocated
          FROM properties_paymentallocation
         WHERE mpesa_transaction_id = NEW.mpesa_transaction_id
           AND id <> OLD.id;
    ELSE
        SELECT COALESCE(SUM(amount_allocated), 0)
          INTO transaction_allocated
          FROM properties_paymentallocation
         WHERE mpesa_transaction_id = NEW.mpesa_transaction_id;
    END IF;

    IF transaction_allocated + NEW.amount_allocated > transaction_amount THEN
        RAISE EXCEPTION 'Payment allocations cannot exceed the transaction amount.';
    END IF;

    IF NEW.invoice_id IS NOT NULL THEN
        SELECT COALESCE(SUM(amount), 0)
          INTO invoice_total
          FROM billing_invoiceitem
         WHERE invoice_id = NEW.invoice_id;

        IF TG_OP = 'UPDATE' AND NEW.invoice_id = OLD.invoice_id THEN
            SELECT COALESCE(SUM(amount_allocated), 0)
              INTO invoice_allocated
              FROM properties_paymentallocation
             WHERE invoice_id = NEW.invoice_id
               AND id <> OLD.id;
        ELSE
            SELECT COALESCE(SUM(amount_allocated), 0)
              INTO invoice_allocated
              FROM properties_paymentallocation
             WHERE invoice_id = NEW.invoice_id;
        END IF;

        IF invoice_allocated + NEW.amount_allocated > invoice_total THEN
            RAISE EXCEPTION 'Invoice allocations cannot exceed its total.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_payment_allocation_before_write
BEFORE INSERT OR UPDATE ON properties_paymentallocation
FOR EACH ROW EXECUTE FUNCTION geopima_validate_payment_allocation();
"""


REVERSE_SQL = """
DROP TRIGGER IF EXISTS geopima_payment_allocation_before_write ON properties_paymentallocation;
DROP FUNCTION IF EXISTS geopima_validate_payment_allocation();
"""


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0007_invoice_relationship_and_item_integrity'),
        ('properties', '0004_property_property_id_not_blank'),
    ]

    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
    ]
