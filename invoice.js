document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'https://geopima.onrender.com/api/v1'; // Update to http://127.0.0.1:8000/api/v1 for local testing

  async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  }

  const urlParams = new URLSearchParams(window.location.search);
  const invoiceId = urlParams.get('id');

  if (!invoiceId) {
    alert('No invoice ID specified in URL.');
    return;
  }

  async function loadInvoiceDetails() {
    try {
      const data = await fetchAPI(`/billing/invoices/${invoiceId}/`);
      populateInvoiceUI(data);
    } catch (err) {
      console.error('Failed to load invoice details:', err);
      alert('Could not retrieve invoice details from server.');
    }
  }

  function populateInvoiceUI(inv) {
    const invNo = inv.invoice_no || inv.invoice_number || 'INV000001';
    
    const breadcrumbEl = document.getElementById('breadcrumb-inv-no');
    if (breadcrumbEl) breadcrumbEl.textContent = invNo;

    document.getElementById('inv-num').textContent = invNo;
    document.getElementById('inv-period').textContent = inv.period || 'AUGUST-2026';
    document.getElementById('inv-date').textContent = inv.date || inv.issue_date || '5-Aug-2026';

    const tenantBlock = document.querySelector('.tenant-details-block');
    if (tenantBlock) {
      tenantBlock.innerHTML = `
        <h3>Invoice To:</h3>
        <p class="tenant-name"><strong>${inv.tenant || 'Tenant'} (${inv.tnt || 'TNT'})</strong></p>
        <p><strong>Property:</strong> ${inv.property || 'N/A'}</p>
        <p><strong>Unit No:</strong> ${inv.unit || 'N/A'}</p>
        <p><strong>Contact:</strong> ${inv.tenant_contact || 'N/A'}</p>
        <p><strong>Credit Bank Paybill:</strong> ${inv.credit_bank_paybill || '6775'}</p>
        <p><strong>Account Number:</strong> ${inv.smart_alias || 'Smart Alias unavailable'}</p>
      `;
    }

    const lineItemsBody = document.getElementById('line-items-body');
    if (lineItemsBody) {
      lineItemsBody.innerHTML = '';
      const items = inv.items || [];
      
      if (items.length === 0) {
        lineItemsBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No line items found</td></tr>`;
      } else {
        items.forEach(item => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${item.item_type || 'Rent'}</td>
            <td>${item.description || 'House Rent'}</td>
            <td class="text-right">${Number(item.amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            <td class="text-center no-print">
              <button class="btn-icon-cog" title="Item Options"><i class="fa-solid fa-gear"></i> <i class="fa-solid fa-caret-down"></i></button>
            </td>
          `;
          lineItemsBody.appendChild(tr);
        });
      }
    }

    const currentAmt = Number(inv.current || inv.net_total || 0);
    const paidAmt = Number(inv.paid || inv.rent_paid || 0);
    const balanceAmt = Number(inv.balance || 0);

    document.getElementById('summary-subtotal').textContent = currentAmt.toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('summary-nettotal').textContent = currentAmt.toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('summary-lesspaid').textContent = paidAmt.toLocaleString('en-US', {minimumFractionDigits: 2});
    
    const balanceEl = document.getElementById('summary-balance');
    balanceEl.textContent = balanceAmt.toLocaleString('en-US', {minimumFractionDigits: 2});
    balanceEl.className = balanceAmt < 0 ? 'text-credit' : '';

    const paymentBody = document.getElementById('payment-details-body');
    if (paymentBody) {
      paymentBody.innerHTML = '';
      const payments = inv.payment_details || [];

      if (payments.length === 0) {
        paymentBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#777; padding: 15px;">No payments recorded yet.</td></tr>`;
        document.getElementById('total-paid-footer').textContent = '0.00';
      } else {
        let totalPaid = 0;
        payments.forEach((p, idx) => {
          totalPaid += Number(p.amount || 0);
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${idx + 1}</td>
            <td><a href="#" class="receipt-link">${p.receipt_no || 'N/A'}</a></td>
            <td>${p.bank || 'Lipa Na M-pesa'}<br><small class="text-muted">REF#: ${p.receipt_no || 'N/A'}</small></td>
            <td>${p.type || 'Mpesa'}</td>
            <td>${p.date_paid || '-'}</td>
            <td>${p.via || 'Manual'}</td>
            <td class="text-right">${Number(p.amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
          `;
          paymentBody.appendChild(tr);
        });
        document.getElementById('total-paid-footer').textContent = totalPaid.toLocaleString('en-US', {minimumFractionDigits: 2});
      }
    }
  }

  const downloadPdfBtn = document.getElementById('btn-download-pdf');
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', () => window.print());
  }

  const sendLinkBtn = document.getElementById('btn-send-link');
  if (sendLinkBtn) {
    sendLinkBtn.addEventListener('click', () => alert('Invoice live view link sent via SMS to tenant.'));
  }

  const modalPayment = document.getElementById('modal-payment');
  const addPaymentBtn = document.getElementById('btn-add-payment');
  const closeModalBtns = document.querySelectorAll('.close-modal');

  if (addPaymentBtn && modalPayment) {
    addPaymentBtn.addEventListener('click', () => modalPayment.classList.add('active'));
  }

  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (modalPayment) modalPayment.classList.remove('active');
    });
  });

  const formAddPayment = document.getElementById('form-add-payment');
  if (formAddPayment) {
    formAddPayment.addEventListener('submit', async (e) => {
      e.preventDefault();

      const payRef = document.getElementById('pay-ref').value;
      const payChannel = document.getElementById('pay-channel').value;
      const payAmount = parseFloat(document.getElementById('pay-amount').value);

      if (!payAmount || payAmount <= 0) {
        alert('Please enter a valid payment amount.');
        return;
      }

      try {
        await fetchAPI(`/billing/invoices/${invoiceId}/add-payment/`, {
          method: 'POST',
          body: JSON.stringify({
            reference: payRef,
            channel: payChannel,
            amount: payAmount
          })
        });

        alert('Payment successfully recorded and allocated.');
        modalPayment.classList.remove('active');
        formAddPayment.reset();
        loadInvoiceDetails();
      } catch (err) {
        console.error('Failed to record payment:', err);
        alert('Error recording payment on server.');
      }
    });
  }

  loadInvoiceDetails();
});