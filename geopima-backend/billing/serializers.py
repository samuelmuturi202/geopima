from rest_framework import serializers
from .models import VoteHead, Deposit, Invoice, InvoiceItem, Agency, SmartAliasTransaction


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

    invoice_no = serializers.CharField(source='invoice_number')
    period = serializers.CharField(source='period_formatted')
    date = serializers.DateField(source='issue_date', format="%d-%b-%Y")

    tenant_name_code = serializers.SerializerMethodField()
    property_name = serializers.CharField(source='unit.property.name')
    unit_no = serializers.CharField(source='unit.unit_name')
    tenant_contact = serializers.SerializerMethodField()

    items = InvoiceItemSerializer(many=True, read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    net_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    
    rent_paid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    payment_details = serializers.SerializerMethodField()
    total_paid = serializers.DecimalField(source='rent_paid', max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'agency_name', 'agency_address', 'agency_email', 'agency_contact',
            'invoice_no', 'period', 'date',
            'tenant_name_code', 'property_name', 'unit_no', 'tenant_contact',
            'items', 'subtotal', 'net_total', 'rent_paid', 'balance',
            'payment_details', 'total_paid'
        ]

    def get_tenant_name_code(self, obj):
        tenant_name = getattr(obj.tenant, 'name', None) or getattr(obj.tenant, 'full_name', '')
        tenant_code = getattr(obj.tenant, 'tenant_id', None) or getattr(obj.tenant, 'tenant_code', '')
        return f"{str(tenant_name).upper()} ({tenant_code})"

    def get_tenant_contact(self, obj):
        return getattr(obj.tenant, 'phone_number', getattr(obj.tenant, 'phone', '-'))

    def get_payment_details(self, obj):
        allocations = getattr(obj, 'allocations', None)
        if allocations is not None:
            return PaymentDetailSerializer(allocations.all(), many=True).data
        return []