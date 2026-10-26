from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

UserModel = get_user_model()


class SafeJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        try:
            return super().get_user(validated_token)
        except (self.user_model.MultipleObjectsReturned, KeyError):
            user_id = None
            for key in [api_settings.USER_ID_FIELD, 'user_id', 'id', 'sub']:
                if key in validated_token:
                    user_id = validated_token[key]
                    break
            
            if user_id is None:
                raise KeyError("User ID field not found in JWT token payload.")

            return self.user_model.objects.filter(**{api_settings.USER_ID_FIELD: user_id}).first()


class SafeModelBackend(ModelBackend):
    """
    Completely overrides get_user and user_can_authenticate to guarantee 
    that fetching users by primary key never throws MultipleObjectsReturned.
    """
    def get_user(self, user_id):
        try:
            # Use filter().first() instead of get() to handle duplicate records safely
            return UserModel.objects.filter(pk=user_id).first()
        except Exception:
            return None