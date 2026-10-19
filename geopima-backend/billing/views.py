from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.core.management import call_command
from .models import VoteHead, Deposit, Invoice
from .serializers import (
    VoteHeadSerializer, 
    DepositSerializer, 
    InvoiceDetailSerializer
)


class DashboardMetricsView(APIView):
    """
    API View for population & unit occupancy chart metrics.
    """
    authentication_classes = []  # Disables global authentication backends
    permission_classes = [AllowAny]

    def get(self, request):
        data = {
            "properties": ["Block A", "Block B", "Block C", "Block D"],
            "total_units": [40, 25, 30, 15],
            "occupied_units": [35, 20, 28, 10]
        }
        return Response(data, status=status.HTTP_200_OK)


class PaymentSummariesView(APIView):
    """
    API View for progress bars showing rent collection summaries.
    """
    authentication_classes = []  # Disables global authentication backends
    permission_classes = [AllowAny]

    def get(self, request):
        data = [
            {"name": "Rent Collection", "collected": 450000, "total": 500000, "pct": 90},
            {"name": "Water Collection", "collected": 18000, "total": 20000, "pct": 90},
            {"name": "Garbage Collection", "collected": 5000, "total": 10000, "pct": 50}
        ]
        return Response(data, status=status.HTTP_200_OK)


class VoteHeadViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for managing Vote Heads.
    Supports list, create, update, delete, and ordering capabilities.
    """
    queryset = VoteHead.objects.all().order_by('priority_order')
    serializer_class = VoteHeadSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'title', 'code']

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        priority_ids = request.data.get('priority_order', [])
        for index, item_id in enumerate(priority_ids):
            VoteHead.objects.filter(id=item_id).update(priority_order=index)
        return Response({'status': 'priority sequence updated'}, status=status.HTTP_200_OK)


class DepositViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for managing Tenant Deposits.
    """
    queryset = Deposit.objects.select_related('tenant', 'unit').all().order_by('-id')
    serializer_class = DepositSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ['deposit_code', 'reference_no', 'tenant__name', 'tenant__tenant_id']


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for managing Invoices and PDF detail rendering.
    Includes custom action to trigger automated monthly billing.
    """
    queryset = Invoice.objects.select_related('tenant', 'unit', 'unit__property').all().order_by('-id')
    serializer_class = InvoiceDetailSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'invoice_number', 
        'tenant__name', 
        'tenant__tenant_id', 
        'unit__unit_name'
    ]

    @action(detail=False, methods=['post'], url_path='generate-monthly')
    def generate_monthly(self, request):
        """
        Triggers the management command to generate monthly invoices for active leases.
        """
        try:
            call_command('generate_monthly_invoices')
            return Response(
                {'detail': 'Monthly invoices generated successfully.'}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to generate invoices: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )# billing/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.decorators import permission_classes, authentication_classes
from rest_framework import status

class DashboardMetricsView(APIView):
    authentication_classes = ()  # Must be an empty tuple/list
    permission_classes = (AllowAny,)

    def get(self, request):
        data = {
            "properties": ["Block A", "Block B", "Block C", "Block D"],
            "total_units": [40, 25, 30, 15],
            "occupied_units": [35, 20, 28, 10]
        }
        return Response(data, status=status.HTTP_200_OK)


class PaymentSummariesView(APIView):
    authentication_classes = ()  # Must be an empty tuple/list
    permission_classes = (AllowAny,)

    def get(self, request):
        data = [
            {"name": "Rent Collection", "collected": 450000, "total": 500000, "pct": 90},
            {"name": "Water Collection", "collected": 18000, "total": 20000, "pct": 90},
            {"name": "Garbage Collection", "collected": 5000, "total": 10000, "pct": 50}
        ]
        return Response(data, status=status.HTTP_200_OK)