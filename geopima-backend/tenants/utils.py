import re

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