import re
from dataclasses import dataclass

import requests

from tenants.utils import normalize_phone_number


CELCOM_SEND_SMS_URL = 'https://isms.celcomafrica.com/api/services/sendsms/'


class SMSGatewayError(Exception):
    pass


class SMSGatewayConfigurationError(SMSGatewayError):
    pass


class SMSDeliveryRejected(SMSGatewayError):
    pass


class SMSDeliveryUncertain(SMSGatewayError):
    pass


@dataclass(frozen=True)
class SMSDelivery:
    message_id: str


def _provider_response_code(response_data):
    if not isinstance(response_data, dict):
        return None
    responses = response_data.get('responses')
    if isinstance(responses, list) and responses:
        response_data = responses[0]
    if not isinstance(response_data, dict):
        return None
    for key in ('response-code', 'response_code', 'respose-code', 'code'):
        if key in response_data:
            try:
                return int(response_data[key])
            except (TypeError, ValueError):
                return None
    return None


def _provider_message_id(response_data):
    if not isinstance(response_data, dict):
        return ''
    responses = response_data.get('responses')
    if isinstance(responses, list) and responses:
        response_data = responses[0]
    if not isinstance(response_data, dict):
        return ''
    return str(response_data.get('messageid') or response_data.get('messageId') or '')[:100]


def send_sms(config, phone_number, message):
    provider = (config.service_provider or '').strip().casefold()
    if provider not in {'celcom africa', 'celcom'}:
        raise SMSGatewayConfigurationError(
            'Select Celcom Africa as the SMS gateway in Configuration.'
        )
    if not config.partner_id or not config.partner_key or not config.sender_id:
        raise SMSGatewayConfigurationError(
            'Configure the Celcom Partner ID, API key, and Sender ID before sending.'
        )

    mobile = normalize_phone_number(phone_number)
    if not re.fullmatch(r'254[17]\d{8}', mobile):
        raise SMSGatewayConfigurationError(
            'Recipient phone number must be a valid Kenyan mobile number.'
        )

    payload = {
        'apikey': config.partner_key,
        'partnerID': config.partner_id,
        'mobile': mobile,
        'message': message,
        'shortcode': config.sender_id,
        'pass_type': 'plain',
    }

    try:
        response = requests.post(
            CELCOM_SEND_SMS_URL,
            json=payload,
            headers={'Accept': 'application/json'},
            timeout=(5, 20),
        )
    except requests.RequestException as error:
        raise SMSDeliveryUncertain(
            'The SMS provider connection failed. Check the Celcom dashboard before retrying.'
        ) from error

    if response.status_code >= 500:
        raise SMSDeliveryUncertain(
            f'Celcom returned HTTP {response.status_code}; check provider status before retrying.'
        )
    if not response.ok:
        raise SMSDeliveryRejected(f'Celcom rejected the request (HTTP {response.status_code}).')

    try:
        response_data = response.json()
    except ValueError as error:
        raise SMSDeliveryUncertain(
            'Celcom returned an unreadable response. Check provider status before retrying.'
        ) from error

    code = _provider_response_code(response_data)
    if code == 200:
        return SMSDelivery(message_id=_provider_message_id(response_data))
    if code is None:
        raise SMSDeliveryUncertain(
            'Celcom returned no recognizable delivery response. Check provider status before retrying.'
        )
    raise SMSDeliveryRejected(f'Celcom rejected the SMS (provider response code {code}).')
