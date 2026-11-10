from django.db import migrations


FORWARD_SQL = """
CREATE OR REPLACE FUNCTION geopima_validate_ledger_transaction_amount()
RETURNS trigger AS $$
DECLARE
    amount_allocated numeric(14, 2);
BEGIN
    IF NEW.amount IS NOT DISTINCT FROM OLD.amount THEN
        RETURN NEW;
    END IF;
    SELECT COALESCE(SUM(amount_allocated), 0)
      INTO amount_allocated
      FROM properties_paymentallocation
     WHERE mpesa_transaction_id = NEW.id;
    IF NEW.amount < amount_allocated THEN
        RAISE EXCEPTION 'Transaction amount cannot be less than its existing allocations.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_ledger_transaction_amount_before_update
BEFORE UPDATE OF amount ON properties_mpesatransaction
FOR EACH ROW EXECUTE FUNCTION geopima_validate_ledger_transaction_amount();
"""


REVERSE_SQL = """
DROP TRIGGER IF EXISTS geopima_ledger_transaction_amount_before_update ON properties_mpesatransaction;
DROP FUNCTION IF EXISTS geopima_validate_ledger_transaction_amount();
"""


class Migration(migrations.Migration):

    dependencies = [
        ('properties', '0005_payment_allocation_database_integrity'),
    ]

    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
    ]
