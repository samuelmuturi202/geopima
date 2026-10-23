from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings

class SafeJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        try:
            return super().get_user(validated_token)
        except self.user_model.MultipleObjectsReturned:
            # Fallback gracefully to the first user record if duplicates exist
            user_id = validated_token[api_settings.USER_ID_FIELD]
            return self.user_model.objects.filter(**{api_settings.USER_ID_FIELD: user_id}).first()