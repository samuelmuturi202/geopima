from pathlib import Path
from django.http import FileResponse
from rest_framework import viewsets, filters, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Q

from config_core.permissions import RolePermission
from properties.models import Landlord, Property, PropertyAgreement, Unit, UnitOption
from .serializers import (
    LandlordSerializer, PropertyAgreementSerializer, PropertySerializer,
    UnitSerializer, UnitOptionSerializer,
)


class LandlordViewSet(viewsets.ModelViewSet):
    queryset = Landlord.objects.all()
    serializer_class = LandlordSerializer
    permission_classes = [RolePermission]
    role_permission_module = 'landlord'
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'landlord_id', 'phone_number', 'address']

    def get_queryset(self):
        return Landlord.objects.all().order_by('-id')


class PropertyViewSet(viewsets.ModelViewSet):
    queryset = Property.objects.all()
    serializer_class = PropertySerializer
    permission_classes = [RolePermission]
    role_permission_module = 'property'
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'property_id', 'location', 'landlord__name']
    
    lookup_field = 'property_id' 
    lookup_url_kwarg = 'property_id'

    def get_queryset(self):
        queryset = Property.objects.select_related('landlord').all().order_by('-id')
        landlord_param = self.request.query_params.get('landlord')
        if landlord_param:
            queryset = queryset.filter(landlord_id=landlord_param)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_update(serializer)
        return Response(serializer.data)


class PropertyAgreementViewSet(viewsets.ModelViewSet):
    queryset = PropertyAgreement.objects.select_related('property').all()
    serializer_class = PropertyAgreementSerializer
    permission_classes = [RolePermission]
    role_permission_module = 'property'
    filter_backends = [filters.SearchFilter]
    search_fields = ['description', 'property__name', 'property__property_id']

    def get_queryset(self):
        queryset = super().get_queryset()
        property_value = self.request.query_params.get('property')
        if property_value:
            if property_value.isdigit():
                queryset = queryset.filter(
                    Q(property__property_id=property_value)
                    | Q(property_id=int(property_value))
                )
            else:
                queryset = queryset.filter(property__property_id=property_value)
        return queryset

    def download_file(self, request, pk=None):
        agreement = self.get_object()
        return FileResponse(
            agreement.agreement_file.open('rb'),
            as_attachment=True,
            filename=Path(agreement.agreement_file.name).name,
        )


class UnitViewSet(viewsets.ModelViewSet):
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer
    permission_classes = [RolePermission]
    role_permission_module = 'unit'
    role_permission_actions = {'tenants': 'access'}
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
    filter_backends = [filters.SearchFilter]
    search_fields = ['unit_no', 'unit_name', 'property__name', 'property__property_id']

    def get_queryset(self):
        queryset = Unit.objects.select_related('property', 'property__landlord').all().order_by('-id')
        
        property_id_param = self.request.query_params.get('property_id')
        property_param = self.request.query_params.get('property')
        landlord_param = self.request.query_params.get('landlord')
        
        if property_id_param:
            queryset = queryset.filter(property__property_id=property_id_param)
        elif property_param and property_param != 'All':
            if property_param.isdigit():
                queryset = queryset.filter(property_id=property_param)
            else:
                queryset = queryset.filter(
                    Q(property__property_id__iexact=property_param) |
                    Q(property__name__iexact=property_param)
                )
            
        if landlord_param and landlord_param != 'All':
            queryset = queryset.filter(property__landlord_id=landlord_param)
            
        vacancy_param = self.request.query_params.get('vacancy')
        if vacancy_param and vacancy_param != 'All':
            is_vacant = (vacancy_param.lower() == 'vacant')
            queryset = queryset.filter(is_occupied=not is_vacant)
            
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'All':
            queryset = queryset.filter(status__iexact=status_param)
            
        return queryset

    def tenants(self, request, pk=None):
        from tenants.models import Tenant
        from tenants.serializers import TenantSerializer

        unit = self.get_object()
        tenants = Tenant.objects.filter(unit=unit).order_by('-entry_date', '-tenant_id')
        return Response(TenantSerializer(tenants, many=True).data)


class UnitOptionViewSet(viewsets.ModelViewSet):
    queryset = UnitOption.objects.all()
    serializer_class = UnitOptionSerializer
    permission_classes = [RolePermission]
    role_permission_module = 'unit'
    role_permission_actions = {'sync': 'update'}
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        queryset = UnitOption.objects.all()
        kind = self.request.query_params.get('kind')
        if kind:
            queryset = queryset.filter(kind=kind)
        return queryset

    @action(detail=False, methods=['post'], url_path='sync')
    def sync(self, request):
        kind = request.data.get('kind')
        options = request.data.get('options')
        if kind not in {'type', 'category'}:
            return Response({'kind': 'Choose type or category.'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(options, list):
            return Response({'options': 'Options must be a list.'}, status=status.HTTP_400_BAD_REQUEST)
        if any(not isinstance(option, dict) for option in options):
            return Response({'options': 'Each option must be an object.'}, status=status.HTTP_400_BAD_REQUEST)

        normalized_options = []
        for option in options:
            name = option.get('name')
            option_id = option.get('id')
            is_active = option.get('is_active')
            if (
                not isinstance(name, str)
                or not name.strip()
                or len(name.strip()) > 50
                or (option_id is not None and (isinstance(option_id, bool) or not isinstance(option_id, int) or option_id <= 0))
                or not isinstance(is_active, bool)
            ):
                return Response(
                    {'options': 'Each option needs a name of at most 50 characters and a boolean active state.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            normalized_options.append({
                'id': option_id,
                'name': name.strip(),
                'is_active': is_active,
            })

        names = [option['name'].casefold() for option in normalized_options]
        option_ids = [option['id'] for option in normalized_options if option['id'] is not None]
        if len(names) != len(set(names)) or len(option_ids) != len(set(option_ids)):
            return Response({'options': 'Each option must have a unique, non-empty name.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            instances_by_id = {
                instance.pk: instance
                for instance in UnitOption.objects.filter(pk__in=option_ids, kind=kind)
            }
            if len(instances_by_id) != len(option_ids):
                return Response({'options': 'An option no longer exists.'}, status=status.HTTP_409_CONFLICT)

            pending = []
            for option in normalized_options:
                instance = instances_by_id.get(option['id']) if option['id'] is not None else (
                    UnitOption.objects.filter(kind=kind, name__iexact=option['name']).first()
                )
                serializer = self.get_serializer(
                    instance,
                    data={
                        'kind': kind,
                        'name': option['name'],
                        'is_active': option['is_active'],
                    },
                )
                serializer.is_valid(raise_exception=True)
                pending.append(serializer)

            saved_options = [serializer.save() for serializer in pending]
        return Response(self.get_serializer(saved_options, many=True).data)