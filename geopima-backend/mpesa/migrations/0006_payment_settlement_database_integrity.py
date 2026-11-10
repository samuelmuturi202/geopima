from django.db import migrations


FORWARD_SQL = """
CREATE OR REPLACE FUNCTION geopima_validate_payment_settlement()
RETURNS trigger AS $$
DECLARE
    invoice_tenant_id varchar(20);
    transaction_amount numeric(14, 2);
    already_applied numeric(14, 2);
BEGIN
    IF TG_OP = 'UPDATE'
       AND NEW.invoice_id IS NOT DISTINCT FROM OLD.invoice_id
       AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id
       AND NEW.transaction_id IS NOT DISTINCT FROM OLD.transaction_id THEN
        RETURN NEW;
    END IF;

    IF NEW.invoice_id IS NOT NULL THEN
        SELECT tenant_id INTO invoice_tenant_id
          FROM billing_invoice
         WHERE id = NEW.invoice_id;
        IF invoice_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
            RAISE EXCEPTION 'Payment settlement tenant must match the invoice tenant.';
        END IF;
    END IF;

    SELECT trans_amount INTO transaction_amount
      FROM mpesa_mpesatransaction
     WHERE id = NEW.transaction_id
     FOR UPDATE;
    IF transaction_amount IS NULL THEN
        RAISE EXCEPTION 'Payment settlement requires a valid transaction.';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        SELECT COALESCE(SUM(amount_applied), 0)
          INTO already_applied
          FROM mpesa_paymentsettlement
         WHERE transaction_id = NEW.transaction_id
           AND id <> OLD.id;
    ELSE
        SELECT COALESCE(SUM(amount_applied), 0)
          INTO already_applied
          FROM mpesa_paymentsettlement
         WHERE transaction_id = NEW.transaction_id;
    END IF;

    IF already_applied + NEW.amount_applied > transaction_amount THEN
        RAISE EXCEPTION 'Payment settlements cannot exceed the transaction amount.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_payment_settlement_before_write
BEFORE INSERT OR UPDATE ON mpesa_paymentsettlement
FOR EACH ROW EXECUTE FUNCTION geopima_validate_payment_settlement();
"""


REVERSE_SQL = """
DROP TRIGGER IF EXISTS geopima_payment_settlement_before_write ON mpesa_paymentsettlement;
DROP FUNCTION IF EXISTS geopima_validate_payment_settlement();
"""


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0007_invoice_relationship_and_item_integrity'),
        ('mpesa', '0005_mpesatransaction_mpesa_transaction_amount_positive_and_more'),
        ('properties', '0005_payment_allocation_database_integrity'),
    ]

    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
    ]
