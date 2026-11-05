from rest_framework import serializers
from .models import (
    VoteHead, Deposit, Invoice, InvoiceItem, Agency, SmartAliasTransaction,
    CommunicationDraft,
)


class VoteHeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoteHead
        fields = ['id', 'name', 'title', 'code', 'description', 'status', 'priority_order']


class DepositSerializer(serializers.ModelSerializer):
    tenant_name = serializers.ReadOnlyField(source='tenant.name', default='-')
    property_name = serializers.ReadOnlyField(source='unit.property.name', default='-')
    unit_name = serializers.ReadOnlyField(source='unit.unit_name', default='-')

    class Meta:
        model = Deposit
        fields = ['id', 'deposit_code', 'reference_no', 'tenant_name', 'property_name', 'unit_name', 'amount', 'status']


class SmartAliasTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SmartAliasTransaction
        fields = '__all__'


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = ['item_type', 'description', 'amount']


class PaymentDetailSerializer(serializers.Serializer):
    receipt_no = serializers.SerializerMethodField()
    bank = serializers.SerializerMethodField()
    type = serializers.SerializerMethodField()
    date_paid = serializers.SerializerMethodField()
    via = serializers.SerializerMethodField()
    amount = serializers.SerializerMethodField()

    def get_receipt_no(self, obj):
        if hasattr(obj, 'mpesa_transaction') and obj.mpesa_transaction:
            return getattr(obj.mpesa_transaction, 'mpesa_receipt_number', '-')
        return getattr(obj, 'mpesa_receipt_number', getattr(obj, 'receipt_no', '-'))

    def get_bank(self, obj):
        ref = self.get_receipt_no(obj)
        return f"Lipa Na M-pesa REF#: {ref}"

    def get_type(self, obj):
        if hasattr(obj, 'mpesa_transaction') and obj.mpesa_transaction:
            return getattr(obj.mpesa_transaction, 'transaction_type', 'C2B')
        return getattr(obj, 'transaction_type', 'C2B')

    def get_date_paid(self, obj):
        date_val = getattr(obj, 'allocated_at', None) or getattr(obj, 'created_at', None)
        return date_val.strftime("%d-%m-%Y %H:%M") if date_val else '-'

    def get_via(self, obj):
        tx_type = self.get_type(obj)
        return "Auto" if str(tx_type).lower() == 'c2b' else "Manual"

    def get_amount(self, obj):
        return getattr(obj, 'amount_allocated', None) or getattr(obj, 'amount', 0.00)


class InvoiceDetailSerializer(serializers.ModelSerializer):
    agency_name = serializers.CharField(default="PEMWA AGENCY")
    agency_address = serializers.CharField(default="1254-00200, GPO Nairobi")
    agency_email = serializers.CharField(default="pemwaagency@yahoo.com")
    agency_contact = serializers.CharField(default="0725768616 | 0101768816")

    invoice_no = serializers.CharField(source='invoice_number', read_only=True)
    tnt = serializers.CharField(source='tenant.tenant_id', read_only=True)
    tenant = serializers.CharField(source='tenant.name', read_only=True)
    property = serializers.CharField(source='unit.property.name', read_only=True)
    cluster = serializers.SerializerMethodField()
    unit = serializers.CharField(source='unit.unit_name', read_only=True)
    due = serializers.SerializerMethodField()
    
    expected = serializers.DecimalField(source='net_total', max_digits=12, decimal_places=2, read_only=True)
    prepaid = serializers.DecimalField(default=0.00, max_digits=12, decimal_places=2, read_only=True)
    discount = serializers.DecimalField(default=0.00, max_digits=12, decimal_places=2, read_only=True)
    arrears = serializers.DecimalField(default=0.00, max_digits=12, decimal_places=2, read_only=True)
    current = serializers.DecimalField(source='net_total', max_digits=12, decimal_places=2, read_only=True)
    paid = serializers.DecimalField(source='rent_paid', max_digits=12, decimal_places=2, read_only=True)
    balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    is_cleared = serializers.BooleanField(read_only=True)

    period = serializers.CharField(source='period_formatted', read_only=True)
    date = serializers.DateField(source='issue_date', format="%d-%b-%Y", read_only=True)

    items = InvoiceItemSerializer(many=True, read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    net_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    
    rent_paid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    payment_details = serializers.SerializerMethodField()
    total_paid = serializers.DecimalField(source='rent_paid', max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'agency_name', 'agency_address', 'agency_email', 'agency_contact',
            'invoice_no', 'tnt', 'tenant', 'property', 'cluster', 'unit', 'due',
            'period', 'date', 'expected', 'prepaid', 'discount', 'arrears',
            'current', 'paid', 'balance', 'status', 'is_cleared',
            'items', 'subtotal', 'net_total', 'rent_paid', 'payment_details', 'total_paid'
        ]

    def get_cluster(self, obj):
        if obj.unit and obj.unit.property and hasattr(obj.unit.property, 'cluster'):
            return getattr(obj.unit.property, 'cluster', 'Residential')
        return 'Residential'

    def get_due(self, obj):
        return obj.due_date.day if obj.due_date else 5

    def get_payment_details(self, obj):
        allocations = getattr(obj, 'allocations', None)
        if allocations is not None:
            return PaymentDetailSerializer(allocations.all(), many=True).data
        return []


class CommunicationDraftSerializer(serializers.ModelSerializer):
    invoice_number = serializers.SerializerMethodField()
    property_name = serializers.SerializerMethodField()
    unit_name = serializers.SerializerMethodField()

    class Meta:
        model = CommunicationDraft
        fields = [
            'id', 'recipient_type', 'recipient_name', 'phone_number',
            'reminder_type', 'message', 'status', 'period', 'created_at',
            'invoice_number', 'property_name', 'unit_name',
        ]
        read_only_fields = fields

    def get_invoice_number(self, obj):
        return obj.invoice.invoice_number if obj.invoice_id else None

    def get_property_name(self, obj):
        if obj.invoice_id and obj.invoice.unit_id:
            return obj.invoice.unit.property.name
        return None

    def get_unit_name(self, obj):
        return obj.invoice.unit.unit_name if obj.invoice_id and obj.invoice.unit_id else None