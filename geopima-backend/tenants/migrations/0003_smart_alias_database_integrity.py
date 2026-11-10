from django.db import migrations


FORWARD_SQL = """
CREATE OR REPLACE FUNCTION geopima_normalize_property_identifier()
RETURNS trigger AS $$
BEGIN
    NEW.property_id := upper(btrim(NEW.property_id));
    IF NEW.property_id = '' THEN
        RAISE EXCEPTION 'Property ID cannot be blank.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_property_identifier_before_write
BEFORE INSERT OR UPDATE ON properties_property
FOR EACH ROW EXECUTE FUNCTION geopima_normalize_property_identifier();

CREATE OR REPLACE FUNCTION geopima_normalize_unit_identifier()
RETURNS trigger AS $$
BEGIN
    NEW.unit_no := upper(btrim(NEW.unit_no));
    IF NEW.unit_no = '' THEN
        RAISE EXCEPTION 'Unit number cannot be blank.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_unit_identifier_before_write
BEFORE INSERT OR UPDATE ON properties_unit
FOR EACH ROW EXECUTE FUNCTION geopima_normalize_unit_identifier();

CREATE OR REPLACE FUNCTION geopima_set_tenant_smart_alias()
RETURNS trigger AS $$
BEGIN
    IF NEW.unit_id IS NULL THEN
        NEW.smart_alias := '';
        RETURN NEW;
    END IF;

    SELECT upper(btrim(p.property_id) || '-' || btrim(u.unit_no))
      INTO NEW.smart_alias
      FROM properties_unit u
      JOIN properties_property p ON p.id = u.property_id
     WHERE u.id = NEW.unit_id;

    IF NEW.smart_alias IS NULL OR NEW.smart_alias = '' THEN
        RAISE EXCEPTION 'Cannot generate Smart Alias for unit %.', NEW.unit_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_tenant_smart_alias_before_write
BEFORE INSERT OR UPDATE ON tenants_tenant
FOR EACH ROW EXECUTE FUNCTION geopima_set_tenant_smart_alias();

CREATE OR REPLACE FUNCTION geopima_refresh_unit_tenant_aliases()
RETURNS trigger AS $$
BEGIN
    UPDATE tenants_tenant t
       SET smart_alias = upper(btrim(p.property_id) || '-' || btrim(NEW.unit_no))
      FROM properties_property p
     WHERE t.unit_id = NEW.id
       AND p.id = NEW.property_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_unit_smart_alias_after_identifier_change
AFTER UPDATE OF unit_no, property_id ON properties_unit
FOR EACH ROW EXECUTE FUNCTION geopima_refresh_unit_tenant_aliases();

CREATE OR REPLACE FUNCTION geopima_refresh_property_tenant_aliases()
RETURNS trigger AS $$
BEGIN
    UPDATE tenants_tenant t
       SET smart_alias = upper(btrim(NEW.property_id) || '-' || btrim(u.unit_no))
      FROM properties_unit u
     WHERE t.unit_id = u.id
       AND u.property_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_property_smart_alias_after_identifier_change
AFTER UPDATE OF property_id ON properties_property
FOR EACH ROW EXECUTE FUNCTION geopima_refresh_property_tenant_aliases();

CREATE OR REPLACE FUNCTION geopima_validate_lease_tenant_unit()
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
        RAISE EXCEPTION 'Lease tenant must be assigned to the lease unit.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geopima_lease_tenant_unit_before_write
BEFORE INSERT OR UPDATE OF tenant_id, unit_id ON tenants_leaseagreement
FOR EACH ROW EXECUTE FUNCTION geopima_validate_lease_tenant_unit();

UPDATE tenants_tenant t
   SET smart_alias = upper(btrim(p.property_id) || '-' || btrim(u.unit_no))
  FROM properties_unit u
  JOIN properties_property p ON p.id = u.property_id
 WHERE t.unit_id = u.id;
UPDATE tenants_tenant SET smart_alias = '' WHERE unit_id IS NULL;
"""


REVERSE_SQL = """
DROP TRIGGER IF EXISTS geopima_lease_tenant_unit_before_write ON tenants_leaseagreement;
DROP FUNCTION IF EXISTS geopima_validate_lease_tenant_unit();
DROP TRIGGER IF EXISTS geopima_property_smart_alias_after_identifier_change ON properties_property;
DROP FUNCTION IF EXISTS geopima_refresh_property_tenant_aliases();
DROP TRIGGER IF EXISTS geopima_unit_smart_alias_after_identifier_change ON properties_unit;
DROP FUNCTION IF EXISTS geopima_refresh_unit_tenant_aliases();
DROP TRIGGER IF EXISTS geopima_tenant_smart_alias_before_write ON tenants_tenant;
DROP FUNCTION IF EXISTS geopima_set_tenant_smart_alias();
DROP TRIGGER IF EXISTS geopima_unit_identifier_before_write ON properties_unit;
DROP FUNCTION IF EXISTS geopima_normalize_unit_identifier();
DROP TRIGGER IF EXISTS geopima_property_identifier_before_write ON properties_property;
DROP FUNCTION IF EXISTS geopima_normalize_property_identifier();
"""


class Migration(migrations.Migration):

    dependencies = [
        ('properties', '0004_property_property_id_not_blank'),
        ('tenants', '0002_tenant_smart_alias'),
    ]

    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
    ]
