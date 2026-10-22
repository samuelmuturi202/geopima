document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

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

  // 3. Rent Collections API Fetching & DOM Rendering
  const tableBody = document.getElementById('rent-table-body');
  const recordCountEl = document.getElementById('record-count');
  const searchInput = document.getElementById('search-input');
  const propertyFilter = document.getElementById('property-filter');
  const methodFilter = document.getElementById('payment-method-filter');

  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;">No matching rent collection records found.</td></tr>`;
      if (recordCountEl) recordCountEl.textContent = 'Showing 0 transactions';
      return;
    }

    data.forEach(item => {
      const row = document.createElement('tr');
      const method = item.method || item.payment_method || 'Mpesa';
      const badgeClass = method === 'Mpesa' ? 'badge-mpesa' : (method === 'Bank' ? 'badge-bank' : 'badge-cash');

      row.innerHTML = `
        <td><strong>${item.receiptNo || item.receipt_number || ''}</strong></td>
        <td>${item.dateTime || item.created_at || ''}</td>
        <td>${item.tenant || item.tenant_name || ''}</td>
        <td>${item.property || item.property_name || ''} <br><small style="color:#777;">${item.unit || item.unit_name || ''}</small></td>
        <td><span class="badge ${badgeClass}">${method}</span></td>
        <td><code>${item.refCode || item.reference_code || ''}</code></td>
        <td><strong>KES ${Number(item.amount || 0).toLocaleString()}</strong></td>
        <td><span class="badge badge-success">${item.status || 'Allocated'}</span></td>
        <td>
          <i class="fa-solid fa-print action-icon" title="Print Receipt" onclick="window.open('${API_BASE_URL}/billing/receipts/${item.id}/pdf/', '_blank')"></i>
          <i class="fa-solid fa-eye action-icon" title="View Details"></i>
        </td>
      `;
      tableBody.appendChild(row);
    });

    if (recordCountEl) {
      recordCountEl.textContent = `Showing ${data.length} transaction${data.length > 1 ? 's' : ''}`;
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

      const response = await fetchAPI(`/billing/rent-collections/?${params.toString()}`);
      renderTable(response.results || response);
    } catch (err) {
      console.error('Failed to load rent collections:', err);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:red; padding:20px;">Error loading data from server.</td></tr>`;
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