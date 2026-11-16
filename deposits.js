document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'https://geopima.onrender.com/api/v1';

  // Helper for authenticated API calls
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

  // DOM Elements
  const tableBody = document.querySelector('#deposits-table tbody');
  const searchInput = document.getElementById('table-search');
  const tableInfo = document.getElementById('table-info');
  const entriesSelect = document.getElementById('entries-select');
  const pagination = document.getElementById('deposits-pagination');
  const addDepositBtn = document.getElementById('add-deposit-btn');
  let depositData = [];
  let currentPage = 1;
  let rowsPerPage = Number(entriesSelect?.value || 100);

  // Render Table Rows
  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
      currentPage = 1;
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 15px;">No deposit records found</td></tr>`;
      if (tableInfo) tableInfo.textContent = 'Showing 0 to 0 of 0 entries';
      renderPagination(0);
      return;
    }

    const pageCount = Math.ceil(data.length / rowsPerPage);
    currentPage = Math.min(currentPage, pageCount);
    const start = (currentPage - 1) * rowsPerPage;
    data.slice(start, start + rowsPerPage).forEach((item, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${start + index + 1}</td>
        <td>${item.property_name || item.property || '-'}</td>
        <td>${item.tenant_id || '-'}</td>
        <td>${item.tenant_name || item.tenant || '-'}</td>
        <td>${item.unit_name || item.unit || '-'}</td>
        <td>${Number(item.amount || 0).toLocaleString()} KES</td>
        <td><span class="badge ${item.status === 'refunded' ? 'badge-secondary' : 'badge-success'}">${item.status || 'held'}</span></td>
        <td>-</td>
        <td><button type="button" class="deposit-details" data-id="${item.id}">Details</button></td>
      `;
      tableBody.appendChild(row);
    });

    if (tableInfo) {
      tableInfo.textContent = `Showing ${start + 1} to ${Math.min(start + rowsPerPage, data.length)} of ${data.length} entries`;
    }
    renderPagination(pageCount);
    tableBody.querySelectorAll('.deposit-details').forEach(button => {
      button.addEventListener('click', () => {
        const deposit = data.find(item => String(item.id) === button.dataset.id);
        if (deposit) {
          alert([
            `Deposit: ${deposit.deposit_code}`,
            `Tenant: ${deposit.tenant_name} (${deposit.tenant_id})`,
            `Property: ${deposit.property_name}`,
            `Unit: ${deposit.unit_name}`,
            `Amount: KES ${Number(deposit.amount).toLocaleString()}`,
            `Reference: ${deposit.reference_no || '-'}`,
            `Status: ${deposit.status}`
          ].join('\n'));
        }
      });
    });
  }

  function renderPagination(pageCount) {
    if (!pagination) return;
    pagination.replaceChildren();
    const addButton = (label, page, disabled = false, active = false) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `page-btn${disabled ? ' disabled' : ''}${active ? ' active' : ''}`;
      button.textContent = label;
      button.disabled = disabled;
      button.addEventListener('click', () => {
        currentPage = page;
        renderTable(depositData);
      });
      item.appendChild(button);
      pagination.appendChild(item);
    };
    addButton('Previous', Math.max(1, currentPage - 1), currentPage <= 1);
    for (let page = 1; page <= pageCount; page += 1) addButton(String(page), page, false, page === currentPage);
    addButton('Next', Math.min(pageCount, currentPage + 1), pageCount === 0 || currentPage >= pageCount);
  }

  // Load Deposits from Backend API
  async function loadDeposits(searchQuery = '') {
    if (!tableBody) return;

    try {
      const queryParam = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
      const response = await fetchAPI(`/billing/deposits/${queryParam}`);
      depositData = response.results || response;
      currentPage = 1;
      renderTable(depositData);
    } catch (err) {
      console.error('Failed to fetch deposit records:', err);
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:red; padding:15px;">Error loading deposit records from server.</td></tr>`;
    }
  }

  // Live Table Search Filter Logic with Debounce
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadDeposits(searchInput.value.trim());
      }, 300);
    });
  }
  if (entriesSelect) {
    entriesSelect.addEventListener('change', () => {
      rowsPerPage = Number(entriesSelect.value);
      currentPage = 1;
      renderTable(depositData);
    });
  }

  // Add Deposit Event Trigger
  if (addDepositBtn) {
    addDepositBtn.addEventListener('click', async () => {
      try {
        const tenantsResponse = await fetchAPI('/tenants/');
        const unitsResponse = await fetchAPI('/properties/units/');
        const tenants = tenantsResponse.results || tenantsResponse;
        const units = unitsResponse.results || unitsResponse;
        const tenantList = tenants.map(tenant => `${tenant.tenant_id}: ${tenant.name}`).join('\n');
        const tenantId = prompt(
          `Enter tenant ID:\n${tenantList}`,
          new URLSearchParams(window.location.search).get('tenant') || ''
        );
        if (!tenantId) return;
        const unitList = units.map(unit => `${unit.id}: ${unit.unit_name} (${unit.property_name || unit.property})`).join('\n');
        const unitId = prompt(`Enter the tenant's unit ID:\n${unitList}`);
        if (!unitId) return;
        const depositCode = prompt('Deposit code:');
        if (!depositCode) return;
        const amount = prompt('Deposit amount (KES):');
        if (!amount) return;
        const reference = prompt('Payment reference (optional):') || '';
        await fetchAPI('/billing/deposits/', {
          method: 'POST',
          body: JSON.stringify({
            tenant: tenantId.trim(),
            unit: unitId.trim(),
            deposit_code: depositCode.trim(),
            reference_no: reference.trim(),
            amount: amount.trim()
          })
        });
        await loadDeposits(searchInput?.value.trim() || '');
      } catch (error) {
        alert(`Failed to add deposit: ${error.message}`);
      }
    });
  }

  // Initial Load
  loadDeposits();
});