from django.urls import path
from .views import (
    LandlordViewSet, PropertyAgreementViewSet, PropertyViewSet,
    UnitOptionViewSet, UnitViewSet,
)

app_name = 'properties'

urlpatterns = [
    # 1. Specific literal paths MUST come first
    
    # Landlords endpoints (/api/v1/properties/landlords/)
    path('landlords/', LandlordViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='landlord-list'),

    path('landlords/<int:pk>/', LandlordViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='landlord-detail'),

    path('property-agreements/', PropertyAgreementViewSet.as_view({
        'get': 'list',
        'post': 'create',
    }), name='property-agreement-list'),

    path('property-agreements/<int:pk>/file/', PropertyAgreementViewSet.as_view({
        'get': 'download_file',
    }), name='property-agreement-file'),

    path('property-agreements/<int:pk>/', PropertyAgreementViewSet.as_view({
        'get': 'retrieve',
        'patch': 'partial_update',
        'delete': 'destroy',
    }), name='property-agreement-detail'),

    # Units endpoints (/api/v1/properties/units/)
    path('units/', UnitViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='unit-list'),

    path('units/<int:pk>/', UnitViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='unit-detail'),

    path('units/<int:pk>/tenants/', UnitViewSet.as_view({
        'get': 'tenants'
    }), name='unit-tenants'),

    path('unit-options/', UnitOptionViewSet.as_view({
        'get': 'list',
        'post': 'create',
    }), name='unit-option-list'),

    path('unit-options/<int:pk>/', UnitOptionViewSet.as_view({
        'get': 'retrieve',
        'patch': 'partial_update',
    }), name='unit-option-detail'),

    path('unit-options/sync/', UnitOptionViewSet.as_view({
        'post': 'sync',
    }), name='unit-option-sync'),

    # 2. Base property list/create route
    path('', PropertyViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='property-list'),

    # 3. Generic slug matcher MUST come last so it doesn't intercept 'units' or 'landlords'
    path('<slug:property_id>/', PropertyViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='property-detail'),
]