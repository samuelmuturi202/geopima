from django.urls import path
from .views import LandlordViewSet, PropertyViewSet, UnitViewSet

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