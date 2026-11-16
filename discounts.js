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
    exportExcelBtn.addEventListener('click', (event) => {
      event.preventDefault();
      exportDropdown.classList.remove('active');
      if (!discountData.length) {
        alert('There are no discount records to export.');
        return;
      }
      window.downloadCsv('discounts.csv',
        ['Invoice', 'Landlord', 'Property', 'Unit', 'Tenant ID', 'Tenant', 'Discount', 'Description', 'Amount', 'Period'],
        discountData.map(item => [
          item.invoice || item.invoice_number,
          item.landlordName || item.landlord_name,
          item.propertyName || item.property_name,
          item.unitName || item.unit_name,
          item.tenantId || item.tenant_number,
          item.tenantName || item.tenant_name,
          item.discountName || item.name,
          item.description,
          item.discount || item.amount,
          item.details
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

  // 3. Backend Data Rendering Logic
  let discountData = [];
  let selectedFilters = { cluster: 'ALL', property: 'ALL', period: 'ALL' };
  const tableBody = document.getElementById('discounts-table-body');
  const searchInput = document.getElementById('search-input');
  const entriesSelect = document.getElementById('entries-select');
  const paginationInfo = document.getElementById('pagination-info');
  const previousBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const totalAmount = document.querySelector('.amount-highlight');
  let rowsPerPage = Number(entriesSelect?.value || 10);
  let currentPage = 1;

  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const filteredData = data.filter(item =>
      (selectedFilters.cluster === 'ALL' || item.cluster === selectedFilters.cluster)
      && (selectedFilters.property === 'ALL' || (item.propertyName || item.property_name) === selectedFilters.property)
      && (selectedFilters.period === 'ALL' || item.details === selectedFilters.period)
    );

    if (!filteredData.length) {
      currentPage = 1;
      tableBody.innerHTML = `<tr><td colspan="11" class="empty-msg">No data available in table</td></tr>`;
      if (paginationInfo) paginationInfo.textContent = 'Showing 0 to 0 of 0 entries';
      if (totalAmount) totalAmount.textContent = 'TOTAL: KES. 0.00';
      updatePagination(0);
      return;
    }

    const pageCount = Math.ceil(filteredData.length / rowsPerPage);
    currentPage = Math.min(currentPage, pageCount);
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = filteredData.slice(start, start + rowsPerPage);
    pageData.forEach((item, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${start + index + 1}</td>
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
      paginationInfo.textContent = `Showing ${start + 1} to ${Math.min(start + rowsPerPage, filteredData.length)} of ${filteredData.length} entries`;
    }
    if (totalAmount) {
      const total = filteredData.reduce((sum, item) => sum + Number(item.discount || item.amount || 0), 0);
      totalAmount.textContent = `TOTAL: KES. ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    updatePagination(pageCount);
  }

  function updatePagination(pageCount) {
    if (previousBtn) {
      previousBtn.disabled = currentPage <= 1 || pageCount === 0;
      previousBtn.classList.toggle('disabled', previousBtn.disabled);
    }
    if (nextBtn) {
      nextBtn.disabled = currentPage >= pageCount;
      nextBtn.classList.toggle('disabled', nextBtn.disabled);
    }
  }

  function bindValueFilter(buttonId, filterName, valueOf) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.addEventListener('click', () => {
      const choices = [...new Set(discountData.map(valueOf).filter(Boolean))].sort();
      if (!choices.length) {
        alert('No values are available for this filter.');
        return;
      }
      const selected = prompt(`Enter a value or ALL:\n${choices.join('\n')}`, selectedFilters[filterName]);
      if (selected === null) return;
      const normalized = selected.trim();
      if (normalized.toUpperCase() !== 'ALL' && !choices.includes(normalized)) {
        alert('Select one of the values shown, or enter ALL.');
        return;
      }
      selectedFilters[filterName] = normalized.toUpperCase() === 'ALL' ? 'ALL' : normalized;
      currentPage = 1;
      renderTable(discountData);
    });
  }

  bindValueFilter('filter-cluster-btn', 'cluster', item => item.cluster);
  bindValueFilter('filter-property-btn', 'property', item => item.propertyName || item.property_name);
  bindValueFilter('filter-period-btn', 'period', item => item.details);

  async function loadDiscounts(searchQuery = '') {
    try {
      const queryParam = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
      const response = await fetchAPI(`/billing/discounts/${queryParam}`);
      discountData = response.results || response;
      currentPage = 1;
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

  if (entriesSelect) {
    entriesSelect.addEventListener('change', () => {
      rowsPerPage = Number(entriesSelect.value);
      currentPage = 1;
      renderTable(discountData);
    });
  }
  if (previousBtn) {
    previousBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage -= 1;
        renderTable(discountData);
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentPage += 1;
      renderTable(discountData);
    });
  }

  loadDiscounts();
});