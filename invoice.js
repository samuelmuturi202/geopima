document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'https://geopima.onrender.com/api/v1';

  async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.detail || Object.entries(errorData)
        .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
        .join('\n');
      throw new Error(message || `API Error ${response.status}: ${response.statusText}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  const urlParams = new URLSearchParams(window.location.search);
  const invoiceId = urlParams.get('id');
  const requestedAction = urlParams.get('action');
  let currentInvoice = null;

  if (!invoiceId) {
    alert('No invoice ID specified in URL.');
    return;
  }

  async function loadInvoiceDetails() {
    try {
      const data = await fetchAPI(`/billing/invoices/${invoiceId}/`);
      populateInvoiceUI(data);
      if (requestedAction === 'payment' && modalPayment) {
        modalPayment.classList.add('active');
      }
    } catch (err) {
      console.error('Failed to load invoice details:', err);
      alert(`Could not retrieve invoice details: ${err.message}`);
    }
  }

  function populateInvoiceUI(inv) {
    currentInvoice = inv;
    const invNo = inv.invoice_no || inv.invoice_number || '-';
    
    const breadcrumbEl = document.getElementById('breadcrumb-inv-no');
    if (breadcrumbEl) breadcrumbEl.textContent = invNo;

    document.getElementById('inv-num').textContent = invNo;
    document.getElementById('inv-period').textContent = inv.period || '-';
    document.getElementById('inv-date').textContent = inv.date || inv.issue_date || '-';

    const tenantBlock = document.querySelector('.tenant-details-block');
    if (tenantBlock) {
      tenantBlock.innerHTML = `
        <h3>Invoice To:</h3>
        <p class="tenant-name"><strong>${inv.tenant || '-'} (${inv.tnt || '-'})</strong></p>
        <p><strong>Property:</strong> ${inv.property || '-'}</p>
        <p><strong>Unit No:</strong> ${inv.unit || '-'}</p>
        <p><strong>Contact:</strong> ${inv.tenant_contact || '-'}</p>
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
            <td class="text-center no-print"></td>
          `;
          lineItemsBody.appendChild(tr);
        });
      }
    }

    const currentAmt = Number(inv.current || inv.net_total || 0);
    const subtotalAmt = Number(inv.subtotal ?? currentAmt);
    const netTotalAmt = Number(inv.net_total ?? currentAmt);
    const paidAmt = Number(inv.paid || inv.rent_paid || 0);
    const balanceAmt = Number(inv.balance || 0);

    document.getElementById('summary-subtotal').textContent = subtotalAmt.toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('summary-nettotal').textContent = netTotalAmt.toLocaleString('en-US', {minimumFractionDigits: 2});
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
            <td>${p.receipt_no || '-'}</td>
            <td>${p.bank || '-'}<br><small class="text-muted">REF#: ${p.receipt_no || '-'}</small></td>
            <td>${p.type || '-'}</td>
            <td>${p.date_paid || '-'}</td>
            <td>${p.via || '-'}</td>
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

  const liveViewBtn = document.getElementById('btn-live-view');
  if (liveViewBtn) {
    liveViewBtn.addEventListener('click', () => {
      window.open(window.location.href, '_blank', 'noopener');
    });
  }

  const viewStatementBtn = document.getElementById('btn-view-statement');
  if (viewStatementBtn) {
    viewStatementBtn.addEventListener('click', () => window.print());
  }

  const requestPaymentBtn = document.getElementById('btn-request-payment');
  if (requestPaymentBtn) {
    requestPaymentBtn.addEventListener('click', async () => {
      try {
        const draft = await fetchAPI(`/billing/invoices/${invoiceId}/request-payment/`, { method: 'POST' });
        alert(`Payment request draft ${draft.status === 'pending' ? 'is ready for approval' : 'already exists'}. No SMS was sent.`);
      } catch (error) {
        alert(`Could not create payment request draft: ${error.message}`);
      }
    });
  }

  const offerDiscountBtn = document.getElementById('btn-offer-discount');
  if (offerDiscountBtn) {
    offerDiscountBtn.addEventListener('click', async () => {
      const percentage = prompt('Discount percentage (1-100):');
      if (percentage === null) return;
      try {
        await fetchAPI(`/billing/invoices/${invoiceId}/offer-discount/`, {
          method: 'POST',
          body: JSON.stringify({ percentage: percentage.trim() })
        });
        await loadInvoiceDetails();
        alert('Percentage discount applied to the invoice.');
      } catch (error) {
        alert(`Could not apply discount: ${error.message}`);
      }
    });
  }

  const changeMonthBtn = document.getElementById('btn-change-month');
  if (changeMonthBtn) {
    changeMonthBtn.addEventListener('click', async () => {
      const periodMatch = currentInvoice?.period?.match(/^([A-Z]+)-(\d{4})$/);
      let defaultPeriod = '';
      if (periodMatch) {
        const month = new Date(`${periodMatch[1]} 1, ${periodMatch[2]}`).getMonth() + 1;
        if (!Number.isNaN(month)) defaultPeriod = `${periodMatch[2]}-${String(month).padStart(2, '0')}`;
      }
      const period = prompt('Target invoice month (YYYY-MM):', defaultPeriod);
      if (period === null) return;
      try {
        await fetchAPI(`/billing/invoices/${invoiceId}/change-month/`, {
          method: 'POST',
          body: JSON.stringify({ period: period.trim() })
        });
        await loadInvoiceDetails();
        alert('Invoice month and due date updated.');
      } catch (error) {
        alert(`Could not change invoice month: ${error.message}`);
      }
    });
  }

  const addItemBtn = document.getElementById('btn-add-item');
  if (addItemBtn) {
    addItemBtn.addEventListener('click', async () => {
      const itemType = prompt('Invoice item type:');
      if (itemType === null) return;
      const description = prompt('Description:');
      if (description === null) return;
      const amount = prompt('Amount (KES):');
      if (amount === null) return;
      try {
        await fetchAPI(`/billing/invoices/${invoiceId}/add-item/`, {
          method: 'POST',
          body: JSON.stringify({
            item_type: itemType.trim(),
            description: description.trim(),
            amount: amount.trim()
          })
        });
        await loadInvoiceDetails();
      } catch (error) {
        alert(`Could not add invoice item: ${error.message}`);
      }
    });
  }

  const addDepositBtn = document.getElementById('btn-add-deposit');
  if (addDepositBtn) {
    addDepositBtn.addEventListener('click', () => {
      const tenantId = currentInvoice?.tnt || '';
      window.location.href = `deposits.html?tenant=${encodeURIComponent(tenantId)}`;
    });
  }

  const sendLinkBtn = document.getElementById('btn-send-link');
  if (sendLinkBtn) {
    sendLinkBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('Invoice link copied. No SMS was sent.');
      } catch (error) {
        prompt('Copy this invoice link:', window.location.href);
      }
    });
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
        alert(`Error recording payment: ${err.message}`);
      }
    });
  }

  loadInvoiceDetails();
});