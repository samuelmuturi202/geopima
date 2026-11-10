from django.db import migrations


FORWARD_SQL = """
CREATE OR REPLACE FUNCTION geopima_sync_credit_bank_payment_channel()
RETURNS trigger AS $$
BEGIN
    IF NEW.bank_type = 'smart_alias' THEN
        SELECT paybill_number INTO NEW.business_no
          FROM config_core_creditbankconfig
         WHERE id = 1;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Credit Bank configuration must exist before its payment channel.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_credit_bank_channel_before_write
BEFORE INSERT OR UPDATE ON config_core_paymentbank
FOR EACH ROW EXECUTE FUNCTION geopima_sync_credit_bank_payment_channel();

CREATE OR REPLACE FUNCTION geopima_update_credit_bank_payment_channel()
RETURNS trigger AS $$
BEGIN
    IF NEW.paybill_number IS DISTINCT FROM OLD.paybill_number THEN
        UPDATE config_core_paymentbank
           SET business_no = NEW.paybill_number
         WHERE bank_type = 'smart_alias';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_credit_bank_config_after_paybill_change
AFTER UPDATE OF paybill_number ON config_core_creditbankconfig
FOR EACH ROW EXECUTE FUNCTION geopima_update_credit_bank_payment_channel();

CREATE OR REPLACE FUNCTION geopima_protect_credit_bank_payment_channel()
RETURNS trigger AS $$
BEGIN
    IF OLD.bank_type = 'smart_alias' THEN
        RAISE EXCEPTION 'The Credit Bank Smart Alias payment channel cannot be deleted.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_credit_bank_channel_before_delete
BEFORE DELETE ON config_core_paymentbank
FOR EACH ROW EXECUTE FUNCTION geopima_protect_credit_bank_payment_channel();

CREATE OR REPLACE FUNCTION geopima_validate_credit_bank_config()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'The Credit Bank configuration singleton cannot be deleted.';
    END IF;
    IF NEW.id <> 1 THEN
        RAISE EXCEPTION 'Credit Bank configuration must use ID 1.';
    END IF;
    IF NEW.paybill_number !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Credit Bank Paybill must contain digits only.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_credit_bank_config_before_write
BEFORE INSERT OR UPDATE ON config_core_creditbankconfig
FOR EACH ROW EXECUTE FUNCTION geopima_validate_credit_bank_config();

CREATE TRIGGER geopima_credit_bank_config_before_delete
BEFORE DELETE ON config_core_creditbankconfig
FOR EACH ROW EXECUTE FUNCTION geopima_validate_credit_bank_config();
"""


REVERSE_SQL = """
DROP TRIGGER IF EXISTS geopima_credit_bank_channel_before_delete ON config_core_paymentbank;
DROP FUNCTION IF EXISTS geopima_protect_credit_bank_payment_channel();
DROP TRIGGER IF EXISTS geopima_credit_bank_config_before_delete ON config_core_creditbankconfig;
DROP TRIGGER IF EXISTS geopima_credit_bank_config_before_write ON config_core_creditbankconfig;
DROP FUNCTION IF EXISTS geopima_validate_credit_bank_config();
DROP TRIGGER IF EXISTS geopima_credit_bank_config_after_paybill_change ON config_core_creditbankconfig;
DROP FUNCTION IF EXISTS geopima_update_credit_bank_payment_channel();
DROP TRIGGER IF EXISTS geopima_credit_bank_channel_before_write ON config_core_paymentbank;
DROP FUNCTION IF EXISTS geopima_sync_credit_bank_payment_channel();
"""


class Migration(migrations.Migration):

    dependencies = [
        ('config_core', '0007_paymentbank_one_credit_bank_smart_alias_channel'),
    ]

    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
    ]
