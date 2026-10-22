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

  // 1. Sidebar Toggle & Finance Menu
  const toggleBtn = document.getElementById('toggle-sidebar');
  const sidebar = document.getElementById('sidebar');
  const financeBtn = document.getElementById('finance-dropdown-toggle');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  if (financeBtn) {
    financeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dropdown = financeBtn.closest('.nav-dropdown');
      if (dropdown) dropdown.classList.toggle('open');
    });
  }

  // 2. Export Button Dropdown Logic
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
      window.open(`${API_BASE_URL}/billing/discounts/export/?format=excel`, '_blank');
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      exportDropdown.classList.remove('active');
      window.open(`${API_BASE_URL}/billing/discounts/export/?format=pdf`, '_blank');
    });
  }

  // 3. Backend Data Rendering Logic
  let discountData = [];
  const tableBody = document.getElementById('discounts-table-body');
  const searchInput = document.getElementById('search-input');
  const paginationInfo = document.getElementById('pagination-info');

  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="11" class="empty-msg">No data available in table</td></tr>`;
      if (paginationInfo) paginationInfo.textContent = 'Showing 0 to 0 of 0 entries';
      return;
    }

    data.forEach((item, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${item.invoice || item.invoice_number || ''}</td>
        <td>${item.landlordName || item.landlord_name || ''}</td>
        <td>${item.propertyName || item.property_name || ''}</td>
        <td>${item.unitName || item.unit_name || ''}</td>
        <td>${item.tenantId || item.tenant_number || ''}</td>
        <td>${item.tenantName || item.tenant_name || ''}</td>
        <td>${item.discountName || item.name || ''}</td>
        <td>${item.description || ''}</td>
        <td>KES ${Number(item.discount || item.amount || 0).toLocaleString()}</td>
        <td>${item.details || ''}</td>
      `;
      tableBody.appendChild(row);
    });

    if (paginationInfo) {
      paginationInfo.textContent = `Showing 1 to ${data.length} of ${data.length} entries`;
    }
  }

  async function loadDiscounts(searchQuery = '') {
    try {
      const queryParam = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
      const response = await fetchAPI(`/billing/discounts/${queryParam}`);
      discountData = response.results || response;
      renderTable(discountData);
    } catch (err) {
      console.error('Failed to load discount records:', err);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="11" class="empty-msg" style="color:red;">Error fetching discount records</td></tr>`;
      }
    }
  }

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();
      debounceTimer = setTimeout(() => loadDiscounts(query), 300);
    });
  }

  loadDiscounts();
});