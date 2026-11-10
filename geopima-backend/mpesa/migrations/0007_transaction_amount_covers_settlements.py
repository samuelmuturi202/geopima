from django.db import migrations


FORWARD_SQL = """
CREATE OR REPLACE FUNCTION geopima_validate_mpesa_transaction_amount()
RETURNS trigger AS $$
DECLARE
    amount_settled numeric(14, 2);
BEGIN
    IF NEW.trans_amount IS NOT DISTINCT FROM OLD.trans_amount THEN
        RETURN NEW;
    END IF;
    SELECT COALESCE(SUM(amount_applied), 0)
      INTO amount_settled
      FROM mpesa_paymentsettlement
     WHERE transaction_id = NEW.id;
    IF NEW.trans_amount < amount_settled THEN
        RAISE EXCEPTION 'Transaction amount cannot be less than its existing settlements.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_mpesa_transaction_amount_before_update
BEFORE UPDATE OF trans_amount ON mpesa_mpesatransaction
FOR EACH ROW EXECUTE FUNCTION geopima_validate_mpesa_transaction_amount();
"""


REVERSE_SQL = """
DROP TRIGGER IF EXISTS geopima_mpesa_transaction_amount_before_update ON mpesa_mpesatransaction;
DROP FUNCTION IF EXISTS geopima_validate_mpesa_transaction_amount();
"""


class Migration(migrations.Migration):

    dependencies = [
        ('mpesa', '0006_payment_settlement_database_integrity'),
    ]

    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
    ]
