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
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  }

  // 1. Export Button Dropdown Logic
  const exportDropdown = document.getElementById('export-dropdown');
  const exportToggleBtn = document.getElementById('export-toggle-btn');
  const exportExcelBtn = document.getElementById('export-excel-btn');
  const exportPdfBtn = document.getElementById('export-pdf-btn');

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
    exportExcelBtn.addEventListener('click', () => {
      exportDropdown.classList.remove('active');
      window.open(`${API_BASE_URL}/billing/rent-collections/export/?format=excel`, '_blank');
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      exportDropdown.classList.remove('active');
      window.open(`${API_BASE_URL}/billing/rent-collections/export/?format=pdf`, '_blank');
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
  const searchInput = document.getElementById('search-input');
  const propertyFilter = document.getElementById('property-filter');
  const methodFilter = document.getElementById('payment-method-filter');
  
  const receiptModal = document.getElementById('receipt-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const modalTenantInfo = document.getElementById('modal-tenant-info');
  const modalPaymentDetails = document.getElementById('modal-payment-details');

  if (closeModalBtn) closeModalBtn.addEventListener('click', () => receiptModal.classList.remove('active'));
  if (receiptModal) receiptModal.addEventListener('click', (e) => {
    if (e.target === receiptModal) receiptModal.classList.remove('active');
  });

  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding: 20px;">No matching rent collection records found.</td></tr>`;
      if (recordCountEl) recordCountEl.textContent = 'Showing 0 transactions';
      return;
    }

    data.forEach((item, index) => {
      const row = document.createElement('tr');
      const method = item.method || item.payment_method || 'Lipa Na M-pesa';
      const receiptNo = item.receiptNo || item.receipt_number || `202206${3556 + index}`;
      const tenantNo = item.tenantNo || item.tenant_no || `W${4794 + index}`;
      const amountVal = Number(item.amount || 0);

      row.innerHTML = `
        <td>${index + 1}</td>
        <td><a href="#" class="receipt-link" data-id="${item.id || index}" style="color:#007bff; text-decoration:underline; font-weight:600;">${receiptNo}</a></td>
        <td><a href="#" style="color:#007bff; text-decoration:underline;">${tenantNo}</a></td>
        <td>${item.tenant || item.tenant_name || ''}</td>
        <td><a href="#" style="color:#007bff; text-decoration:underline;">${item.property || item.property_name || ''}</a></td>
        <td>${item.unit || item.unit_name || ''}</td>
        <td>${method}</td>
        <td><code>${item.refCode || item.reference_code || item.trans_id || ''}</code></td>
        <td>${item.type || 'mpesa'}</td>
        <td>${item.slipDate || item.created_at?.split('T')[0] || '30-10-2026'}</td>
        <td>${item.entryDate || item.created_at?.split('T')[0] || '30-10-2026'}</td>
        <td><span style="color:#d99e0b; font-weight:600;">${item.mode || 'auto'}</span></td>
        <td><strong>KES ${amountVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
      `;
      tableBody.appendChild(row);
    });

    if (recordCountEl) {
      recordCountEl.textContent = `Showing ${data.length} transaction${data.length > 1 ? 's' : ''}`;
    }

    // Attach receipt popup triggers to open centered pop-up modal and display details
    document.querySelectorAll('.receipt-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const recordId = e.target.getAttribute('data-id');
        const clickedItem = data[recordId] || data[0];

        try {
          let detail = clickedItem;
          if (clickedItem.id) {
            try {
              detail = await fetchAPI(`/billing/rent-collections/${clickedItem.id}/`);
            } catch (err) {
              // Fallback to row object if item endpoint fails
            }
          }

          modalTenantInfo.innerHTML = `
            <i class="fa-solid fa-user-circle" style="font-size:3.5rem; color:#a0aec0;"></i>
            <div>
              <h3 style="margin:0; font-size:1.1rem; color:#2d3748;">${detail.tenant || detail.tenant_name || 'Glen'}</h3>
              <p style="margin:4px 0 0; font-size:0.82rem; color:#4a5568;">
                TNTNO: ${detail.tenantNo || detail.tenant_no || 'W2570'} / Landlord: ${detail.landlord || 'Nancy Onduko'} / Property: ${detail.property || detail.property_name || 'Onduko Plot'} / Unit: ${detail.unit || detail.unit_name || 'B13'}
              </p>
              <p style="margin:2px 0 0; font-size:0.8rem; color:#718096;"><i class="fa-solid fa-phone"></i> Phone #: ${detail.phone || '254791472363'} &nbsp;&nbsp; Status: <span style="color:#28a745; font-weight:600;">active</span></p>
            </div>
          `;

          modalPaymentDetails.innerHTML = `
            <div style="font-size:0.8rem; font-weight:600; color:#4a5568; margin-bottom:10px;">Payment Details</div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:15px; margin-bottom:15px;">
              <div><label style="font-size:0.72rem; color:#718096; display:block; margin-bottom:4px;">Receipt Number</label><div style="border-bottom:1px solid #cbd5e0; padding-bottom:4px; font-weight:600; color:#2d3748;">${detail.receiptNo || detail.receipt_number || '2022061247'}</div></div>
              <div><label style="font-size:0.72rem; color:#718096; display:block; margin-bottom:4px;">Amount Paid</label><div style="border-bottom:1px solid #cbd5e0; padding-bottom:4px; font-weight:600; color:#2d3748;">${Number(detail.amount || 1000).toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div>
              <div><label style="font-size:0.72rem; color:#718096; display:block; margin-bottom:4px;">Balance</label><div style="border-bottom:1px solid #cbd5e0; padding-bottom:4px; font-weight:600; color:#2d3748;">${Number(detail.balance || 4300).toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div>
              <div><label style="font-size:0.72rem; color:#718096; display:block; margin-bottom:4px;">Bank</label><div style="border-bottom:1px solid #cbd5e0; padding-bottom:4px; font-weight:600; color:#2d3748;">${detail.bank || 'Lipa Na M-Pesa'}</div></div>
              <div><label style="font-size:0.72rem; color:#718096; display:block; margin-bottom:4px;">Reference Number</label><div style="border-bottom:1px solid #cbd5e0; padding-bottom:4px; font-weight:600; color:#2d3748;">${detail.refCode || detail.reference_code || detail.trans_id || 'UJ1OL8KTZO'}</div></div>
              <div><label style="font-size:0.72rem; color:#718096; display:block; margin-bottom:4px;">Slip Date</label><div style="border-bottom:1px solid #cbd5e0; padding-bottom:4px; font-weight:600; color:#2d3748;">${detail.slipDate || detail.created_at?.split('T')[0] || '2026-10-01'}</div></div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:15px; margin-top:15px;">
              <div>
                <label style="font-size:0.78rem; font-weight:600; color:#2d3748; display:block; margin-bottom:4px;">Tenant Note</label>
                <textarea style="width:100%; border:1px solid #cbd5e0; border-radius:4px; padding:6px; font-size:0.8rem; resize:vertical;" rows="2" placeholder="Visible on tenant's receipt">${detail.tenant_note || ''}</textarea>
              </div>
              <div>
                <label style="font-size:0.78rem; font-weight:600; color:#2d3748; display:block; margin-bottom:4px;">Admin Note</label>
                <textarea style="width:100%; border:1px solid #cbd5e0; border-radius:4px; padding:6px; font-size:0.8rem; resize:vertical;" rows="2" placeholder="Not visible on tenant's receipt">${detail.admin_note || ''}</textarea>
              </div>
            </div>
          `;

          receiptModal.classList.add('active');
        } catch (err) {
          alert('Could not open receipt details.');
        }
      });
    });
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
      
      renderTable(response.results || response);
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

  loadRentCollections();
});