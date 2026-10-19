from rest_framework.permissions import BasePermission

class IsSuperAdminOrAdmin(BasePermission):
    """Allows access only to Super Admins and Admins."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        
        role_name = getattr(request.user, 'role', None)
        if role_name and role_name.name in ['Super Admin', 'Admin']:
            return True
        
        return request.user.groups.filter(name__in=['Super Admin', 'Admin']).exists()

class CanManageFinances(BasePermission):
    """Allows access for financial roles (Accountants, Admins, Super Admins)."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True

        role_name = getattr(request.user, 'role', None)
        if role_name and role_name.name in ['Super Admin', 'Admin', 'Accountant']:
            return True

        return request.user.groups.filter(name__in=['Super Admin', 'Admin', 'Accountant']).exists()

class CanManageTemplates(BasePermission):
    """Grants access for managing SMS and agreement templates."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True

        role_name = getattr(request.user, 'role', None)
        if role_name and role_name.name in ['Super Admin', 'Admin', 'Secretary', 'Accountant']:
            return True

        return request.user.groups.filter(name__in=['Super Admin', 'Admin', 'Secretary', 'Accountant']).exists()