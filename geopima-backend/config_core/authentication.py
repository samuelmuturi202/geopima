from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings

class SafeJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        try:
            return super().get_user(validated_token)
        except (self.user_model.MultipleObjectsReturned, KeyError):
            # Check common key variations for the user identifier in the token payload
            user_id = None
            for key in [api_settings.USER_ID_FIELD, 'user_id', 'id', 'sub']:
                if key in validated_token:
                    user_id = validated_token[key]
                    break
            
            if user_id is None:
                raise KeyError("User ID field not found in JWT token payload.")

            # Fallback gracefully to fetch the first user record if duplicates exist
            return self.user_model.objects.filter(**{api_settings.USER_ID_FIELD: user_id}).first()