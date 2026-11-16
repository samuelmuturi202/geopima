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

  // 1. Export Button Dropdown Logic
  const exportDropdown = document.getElementById('export-dropdown');
  const exportToggleBtn = document.getElementById('export-toggle-btn');
  const exportExcelBtn = document.getElementById('export-excel-btn');
  const exportPdfBtn = document.getElementById('export-pdf-btn');
  let rentCollections = [];

  if (exportToggleBtn && exportDropdown) {
    exportToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!exportDropdown.contains(e.target)) {
        exportDropdown.classList.remove('active');
      }
    });
  }

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', (event) => {
      event.preventDefault();
      exportDropdown.classList.remove('active');
      if (!rentCollections.length) {
        alert('There are no rent collection records to export.');
        return;
      }
      window.downloadCsv('rent-collections.csv',
        ['Receipt', 'Tenant ID', 'Tenant', 'Property', 'Unit', 'Method', 'Reference', 'Type', 'Date', 'Amount'],
        rentCollections.map(item => [
          item.receiptNo || item.receipt_number,
          item.tenantNo || item.tenant_no,
          item.tenant || item.tenant_name,
          item.property || item.property_name,
          item.unit || item.unit_name,
          item.method || item.payment_method,
          item.refCode || item.reference_code || item.trans_id,
          item.type,
          item.slipDate || item.created_at,
          item.amount
        ])
      );
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', (event) => {
      event.preventDefault();
      exportDropdown.classList.remove('active');
      window.print();
    });
  }

  // 2. Print Action
  const printBtn = document.getElementById('print-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // 3. Modal Elements & Table Data Rendering
  const tableBody = document.getElementById('rent-table-body');
  const recordCountEl = document.getElementById('record-count');
  const pageInfo = document.getElementById('rent-page-info');
  const pageButtons = document.getElementById('rent-page-buttons');
  const previousPageBtn = document.getElementById('rent-prev-btn');
  const nextPageBtn = document.getElementById('rent-next-btn');
  const searchInput = document.getElementById('search-input');
  const propertyFilter = document.getElementById('property-filter');
  const methodFilter = document.getElementById('payment-method-filter');
  
  const receiptModal = document.getElementById('receipt-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const modalTenantInfo = document.getElementById('modal-tenant-info');
  const modalPaymentDetails = document.getElementById('modal-payment-details');
  const modalInvoicePeriod = document.getElementById('modal-invoice-period');
  const resendNotificationBtn = document.getElementById('resend-notification-btn');
  const collectPaymentBtn = document.getElementById('collect-payment-btn');
  const viewInvoiceBtn = document.getElementById('view-invoice-btn');
  const modalPrintBtn = document.getElementById('modal-print-btn');
  let activeInvoiceId = null;
  let currentPage = 1;
  const rowsPerPage = 10;

  if (closeModalBtn) closeModalBtn.addEventListener('click', () => receiptModal.classList.remove('active'));
  if (receiptModal) receiptModal.addEventListener('click', (e) => {
    if (e.target === receiptModal) receiptModal.classList.remove('active');
  });
  if (resendNotificationBtn) {
    resendNotificationBtn.addEventListener('click', async () => {
      if (!activeInvoiceId) {
        alert('This payment is not linked to an invoice, so a reminder draft cannot be created.');
        return;
      }
      try {
        const draft = await fetchAPI(`/billing/invoices/${activeInvoiceId}/request-payment/`, { method: 'POST' });
        alert(`Payment reminder draft ${draft.status === 'pending' ? 'is ready for approval' : 'already exists'}. No SMS was sent.`);
      } catch (error) {
        alert(`Could not create reminder draft: ${error.message}`);
      }
    });
  }
  if (collectPaymentBtn) {
    collectPaymentBtn.addEventListener('click', () => {
      if (!activeInvoiceId) {
        alert('This payment is not linked to an invoice.');
        return;
      }
      window.location.href = `invoice.html?id=${encodeURIComponent(activeInvoiceId)}&action=payment`;
    });
  }
  if (viewInvoiceBtn) {
    viewInvoiceBtn.addEventListener('click', () => {
      if (!activeInvoiceId) {
        alert('This payment is not linked to an invoice.');
        return;
      }
      window.location.href = `invoice.html?id=${encodeURIComponent(activeInvoiceId)}`;
    });
  }
  if (modalPrintBtn) modalPrintBtn.addEventListener('click', () => window.print());

  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding: 20px;">No matching rent collection records found.</td></tr>`;
      if (recordCountEl) recordCountEl.textContent = 'Showing 0 transactions';
      currentPage = 1;
      renderPagination(0);
      return;
    }

    const pageCount = Math.ceil(data.length / rowsPerPage);
    currentPage = Math.min(currentPage, pageCount);
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = data.slice(start, start + rowsPerPage);
    pageData.forEach((item, index) => {
      const row = document.createElement('tr');
      const method = item.method || item.payment_method || '-';
      const receiptNo = item.receiptNo || item.receipt_number || item.refCode || item.reference_code || '-';
      const tenantNo = item.tenantNo || item.tenant_no || '-';
      const amountVal = Number(item.amount || 0);

      row.innerHTML = `
        <td>${index + 1}</td>
        <td><a href="#" class="receipt-link" data-index="${index}" style="color:#007bff; text-decoration:underline; font-weight:600;">${receiptNo}</a></td>
        <td>${tenantNo}</td>
        <td>${item.tenant || item.tenant_name || ''}</td>
        <td>${item.property || item.property_name || ''}</td>
        <td>${item.unit || item.unit_name || ''}</td>
        <td>${method}</td>
        <td><code>${item.refCode || item.reference_code || item.trans_id || ''}</code></td>
        <td>${item.type || 'mpesa'}</td>
        <td>${item.slipDate || item.created_at?.split('T')[0] || '-'}</td>
        <td>${item.entryDate || item.created_at?.split('T')[0] || '-'}</td>
        <td><span style="color:#d99e0b; font-weight:600;">${item.mode || '-'}</span></td>
        <td><strong>KES ${amountVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
      `;
      tableBody.appendChild(row);
    });

    if (recordCountEl) {
      recordCountEl.textContent = `Showing ${start + 1} to ${Math.min(start + rowsPerPage, data.length)} of ${data.length} transactions`;
    }
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${pageCount}`;
    renderPagination(pageCount);

    // Attach receipt popup triggers to open centered pop-up modal and display details
    document.querySelectorAll('.receipt-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const recordIndex = Number(e.currentTarget.getAttribute('data-index'));
        const clickedItem = pageData[recordIndex];
        if (!clickedItem) return;

        try {
          let detail = clickedItem;
          if (clickedItem.id) {
            detail = await fetchAPI(`/billing/rent-collections/${clickedItem.id}/`);
          }
          activeInvoiceId = detail.invoice_id || detail.invoiceId || clickedItem.invoiceId || null;
          if (modalInvoicePeriod) {
            modalInvoicePeriod.textContent = detail.period || clickedItem.period || 'Invoice period unavailable';
          }
          if (resendNotificationBtn) resendNotificationBtn.disabled = !activeInvoiceId;
          if (collectPaymentBtn) collectPaymentBtn.disabled = !activeInvoiceId;
          if (viewInvoiceBtn) viewInvoiceBtn.disabled = !activeInvoiceId;

          modalTenantInfo.innerHTML = `
            <i class="fa-solid fa-user-circle" style="font-size:3.5rem; color:#a0aec0;"></i>
            <div>
              <h3 style="margin:0; font-size:1.1rem; color:#2d3748;">${detail.tenant || detail.tenant_name || '-'}</h3>
              <p style="margin:4px 0 0; font-size:0.82rem; color:#4a5568;">
                TNTNO: ${detail.tenantNo || detail.tenant_no || '-'} / Landlord: ${detail.landlord || '-'} / Property: ${detail.property || detail.property_name || '-'} / Unit: ${detail.unit || detail.unit_name || '-'}
              </p>
              <p style="margin:2px 0 0; font-size:0.8rem; color:#718096;"><i class="fa-solid fa-phone"></i> Phone #: ${detail.phone || '-'} &nbsp;&nbsp; Status: <span style="color:#28a745; font-weight:600;">${detail.status || '-'}</span></p>
            </div>
          `;

          modalPaymentDetails.innerHTML = `
            <div style="font-size:0.8rem; font-weight:600; color:#4a5568; margin-bottom:10px;">Payment Details</div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:15px; margin-bottom:15px;">
              <div><label style="font-size:0.72rem; color:#718096; display:block; margin-bottom:4px;">Receipt Number</label><div style="border-bottom:1px solid #cbd5e0; padding-bottom:4px; font-weight:600; color:#2d3748;">${detail.receiptNo || detail.receipt_number || '-'}</div></div>
              <div><label style="font-size:0.72rem; color:#718096; display:block; margin-bottom:4px;">Amount Paid</label><div style="border-bottom:1px solid #cbd5e0; padding-bottom:4px; font-weight:600; color:#2d3748;">${Number(detail.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div>
              <div><label style="font-size:0.72rem; color:#718096; display:block; margin-bottom:4px;">Balance</label><div style="border-bottom:1px solid #cbd5e0; padding-bottom:4px; font-weight:600; color:#2d3748;">${detail.balance == null ? '-' : Number(detail.balance).toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div>
              <div><label style="font-size:0.72rem; color:#718096; display:block; margin-bottom:4px;">Bank</label><div style="border-bottom:1px solid #cbd5e0; padding-bottom:4px; font-weight:600; color:#2d3748;">${detail.bank || '-'}</div></div>
              <div><label style="font-size:0.72rem; color:#718096; display:block; margin-bottom:4px;">Reference Number</label><div style="border-bottom:1px solid #cbd5e0; padding-bottom:4px; font-weight:600; color:#2d3748;">${detail.refCode || detail.ref_no || detail.reference_code || detail.trans_id || '-'}</div></div>
              <div><label style="font-size:0.72rem; color:#718096; display:block; margin-bottom:4px;">Slip Date</label><div style="border-bottom:1px solid #cbd5e0; padding-bottom:4px; font-weight:600; color:#2d3748;">${detail.slipDate || detail.slip_date || detail.created_at?.split('T')[0] || '-'}</div></div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:15px; margin-top:15px;">
              <div>
                <label style="font-size:0.78rem; font-weight:600; color:#2d3748; display:block; margin-bottom:4px;">Tenant Note</label>
                <div style="width:100%; border:1px solid #cbd5e0; border-radius:4px; padding:6px; font-size:0.8rem;">${detail.tenant_note || 'Not recorded'}</div>
              </div>
              <div>
                <label style="font-size:0.78rem; font-weight:600; color:#2d3748; display:block; margin-bottom:4px;">Admin Note</label>
                <div style="width:100%; border:1px solid #cbd5e0; border-radius:4px; padding:6px; font-size:0.8rem;">${detail.admin_note || 'Not recorded'}</div>
              </div>
            </div>
          `;

          receiptModal.classList.add('active');
        } catch (err) {
          alert(`Could not open receipt details: ${err.message}`);
        }
      });
    });
  }

  function renderPagination(pageCount) {
    if (previousPageBtn) previousPageBtn.disabled = currentPage <= 1 || pageCount === 0;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= pageCount;
    if (!pageButtons) return;
    pageButtons.innerHTML = '';
    for (let page = 1; page <= pageCount; page += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `page-btn ${page === currentPage ? 'active' : ''}`;
      button.textContent = String(page);
      button.addEventListener('click', () => {
        currentPage = page;
        renderTable(rentCollections);
      });
      pageButtons.appendChild(button);
    }
  }

  async function loadRentCollections() {
    try {
      const query = searchInput ? searchInput.value.trim() : '';
      const selectedProp = propertyFilter ? propertyFilter.value : 'ALL';
      const selectedMethod = methodFilter ? methodFilter.value : 'ALL';

      const params = new URLSearchParams();
      if (query) params.append('search', query);
      if (selectedProp !== 'ALL') params.append('property', selectedProp);
      if (selectedMethod !== 'ALL') params.append('payment_method', selectedMethod);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await fetchAPI(`/billing/rent-collections/${queryString}`);
      rentCollections = response.results || response;
      currentPage = 1;
      renderTable(rentCollections);
    } catch (err) {
      console.error('Failed to load rent collections:', err);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="13" style="text-align:center; color:red; padding:20px;">Error loading data from server.</td></tr>`;
      }
    }
  }

  let debounceTimer;
  const triggerReload = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadRentCollections, 300);
  };

  if (searchInput) searchInput.addEventListener('input', triggerReload);
  if (propertyFilter) propertyFilter.addEventListener('change', loadRentCollections);
  if (methodFilter) methodFilter.addEventListener('change', loadRentCollections);
  if (previousPageBtn) {
    previousPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage -= 1;
        renderTable(rentCollections);
      }
    });
  }
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      if (currentPage < Math.ceil(rentCollections.length / rowsPerPage)) {
        currentPage += 1;
        renderTable(rentCollections);
      }
    });
  }

  loadRentCollections();
});