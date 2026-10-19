from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from .models import Tenant, LeaseAgreement
from .serializers import TenantSerializer, LeaseAgreementSerializer


class TenantViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for managing Tenant records.
    Provides list, create, retrieve, update, and destroy actions.
    Includes full-text search across tenant details.
    """
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'tenant_id', 
        'name', 
        'email', 
        'phone_number', 
        'status'
    ]

    def get_queryset(self):
        queryset = Tenant.objects.select_related('unit__property').all().order_by('-id')
        status = self.request.query_params.get('status')
        property_filter = self.request.query_params.get('property')
        cluster = self.request.query_params.get('cluster')

        if status and status != 'All':
            queryset = queryset.filter(status=status)
        if property_filter and property_filter != 'All':
            queryset = queryset.filter(unit__property__name=property_filter)
        if cluster and cluster != 'All':
            queryset = queryset.filter(cluster=cluster)
        return queryset


class LeaseAgreementViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for managing Lease Agreements.
    Provides full CRUD operations and supports searching by tenant name,
    associated unit name, or agreement template details.
    """
    queryset = LeaseAgreement.objects.select_related('tenant', 'unit', 'template').all().order_by('-id')
    serializer_class = LeaseAgreementSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'tenant__name', 
        'tenant__tenant_id',
        'unit__unit_name', 
        'template__name'
    ]