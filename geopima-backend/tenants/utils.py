import re


def build_smart_alias(property_number, house_number):
    property_number = str(property_number or '').strip().upper()
    house_number = str(house_number or '').strip().upper()
    if not property_number or not house_number:
        return ''
    return f'{property_number}-{house_number}'


def normalize_phone_number(phone_number):
    """
    Normalizes phone numbers to a standard format (e.g., 2547XXXXXXXX).
    """
    if not phone_number:
        return ""
    
    # Strip out non-digit characters
    cleaned = re.sub(r'\D', '', str(phone_number))
    
    if cleaned.startswith('0'):
        return f"254{cleaned[1:]}"
    elif cleaned.startswith('7') or cleaned.startswith('1'):
        return f"254{cleaned}"
    
    return cleaned