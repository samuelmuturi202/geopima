import os
import requests
from django.conf import settings

class CreditBankService:
    def __init__(self):
        self.client_id = os.getenv('CREDIT_BANK_SANDBOX_ID')
        self.secret_key = os.getenv('CREDIT_BANK_SECRET_KEY')
        self.signing_key = os.getenv('CREDIT_BANK_SIGNING_KEY')
        # Update with Credit Bank's actual sandbox/production base URL provided in their API docs
        self.base_url = "https://sandbox.creditbank.co.ke/api/v1" 

    def get_auth_token(self):
        """Authenticates with Credit Bank API using credentials from .env"""
        url = f"{self.base_url}/oauth/token"
        payload = {
            "client_id": self.client_id,
            "client_secret": self.secret_key,
            "grant_type": "client_credentials"
        }
        try:
            response = requests.post(url, json=payload, timeout=10)
            if response.status_code == 200:
                return response.json().get('access_token')
        except requests.RequestException as e:
            print(f"Credit Bank Auth Error: {e}")
        return None