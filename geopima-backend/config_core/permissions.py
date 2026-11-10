from rest_framework.permissions import BasePermission

PERMISSION_MODULES = {
    'email',
    'expense',
    'exports',
    'fee',
    'landlord',
    'message',
    'payment',
    'property',
    'reports',
    'settings',
    'tenant',
    'unit',
    'user',
    'votehead',
}
PERMISSION_ACTIONS = {
    'access',
    'create',
    'update',
    'delete',
    'restore',
    'destroy',
}


def normalize_role_permissions(value):
    if not isinstance(value, list):
        return []
    return {
        permission.strip().lower()
        for permission in value
        if isinstance(permission, str) and permission.strip()
    }


def get_user_role_permissions(user):
    if not user or not user.is_authenticated:
        return set()
    if user.is_superuser:
        return {
            f'{module}_{action}'
            for module in PERMISSION_MODULES
            for action in PERMISSION_ACTIONS
        }

    role_ids = set()
    profile = getattr(user, 'profile', None)
    if profile and profile.role_id:
        role_ids.add(profile.role_id)
    role_ids.update(user.roles.values_list('id', flat=True))
    if not role_ids:
        return set()

    from .models import UserRole

    permissions = set()
    for role_permissions in UserRole.objects.filter(
        pk__in=role_ids
    ).values_list('permissions', flat=True):
        permissions.update(normalize_role_permissions(role_permissions))
    return permissions


class RolePermission(BasePermission):
    """Enforce the persisted role permission matrix on application APIs."""

    message = 'Your assigned role does not grant this action.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if user.is_superuser:
            return True

        action = self._get_action(request, view)
        if not action:
            return False

        action_modules = getattr(view, 'role_permission_action_modules', {})
        module = action_modules.get(
            getattr(view, 'action', None),
            getattr(view, 'role_permission_module', None),
        )
        if not module:
            return False
        module = module.strip().lower()
        if module not in PERMISSION_MODULES:
            return False

        granted = get_user_role_permissions(user)
        if action in {'delete', 'destroy'}:
            return (
                f'{module}_delete' in granted
                or f'{module}_destroy' in granted
            )
        return f'{module}_{action}' in granted

    @staticmethod
    def _get_action(request, view):
        action = getattr(view, 'action', None)
        custom_actions = getattr(view, 'role_permission_actions', {})
        if action in custom_actions:
            return custom_actions[action]
        if request.method.lower() in custom_actions:
            return custom_actions[request.method.lower()]
        if action in {'list', 'retrieve'}:
            return 'access'
        if action in {'create'}:
            return 'create'
        if action in {'update', 'partial_update'}:
            return 'update'
        if action == 'destroy':
            return 'delete'

        return {
            'GET': 'access',
            'HEAD': 'access',
            'OPTIONS': 'access',
            'POST': 'create',
            'PUT': 'update',
            'PATCH': 'update',
            'DELETE': 'delete',
        }.get(request.method.upper())


class IsSuperAdminOrAdmin(RolePermission):
    role_permission_module = 'user'


class CanManageFinances(RolePermission):
    role_permission_module = 'payment'


class CanManageTemplates(RolePermission):
    role_permission_module = 'message'
