document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

  // Helper for authenticated API calls
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

  // DOM Elements
  const tableBody = document.querySelector('#deposits-table tbody');
  const searchInput = document.getElementById('table-search');
  const tableInfo = document.getElementById('table-info');
  const addDepositBtn = document.getElementById('add-deposit-btn');
  const depositModal = document.getElementById('add-deposit-modal');

  // Render Table Rows
  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 15px;">No deposit records found</td></tr>`;
      if (tableInfo) tableInfo.textContent = 'Showing 0 entries';
      return;
    }

    data.forEach((item, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td><strong><a href="#" class="link-code">${item.deposit_code || item.reference_no || ''}</a></strong></td>
        <td>${item.tenant_name || item.tenant || '-'}</td>
        <td>${item.property_name || item.property || '-'}</td>
        <td>${item.unit_name || item.unit || '-'}</td>
        <td>${Number(item.amount || 0).toLocaleString()} KES</td>
        <td><span class="badge ${item.status === 'Refunded' ? 'badge-secondary' : 'badge-success'}">${item.status || 'Active'}</span></td>
      `;
      tableBody.appendChild(row);
    });

    if (tableInfo) {
      tableInfo.textContent = `Showing 1 to ${data.length} of ${data.length} entries`;
    }
  }

  // Load Deposits from Backend API
  async function loadDeposits(searchQuery = '') {
    if (!tableBody) return;

    try {
      const queryParam = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
      const response = await fetchAPI(`/billing/deposits/${queryParam}`);
      const depositList = response.results || response;
      
      renderTable(depositList);
    } catch (err) {
      console.error('Failed to fetch deposit records:', err);
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red; padding:15px;">Error loading deposit records from server.</td></tr>`;
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

  // Add Deposit Event Trigger
  if (addDepositBtn) {
    addDepositBtn.addEventListener('click', () => {
      if (depositModal) {
        depositModal.classList.add('open');
      } else {
        window.location.href = 'add-deposit.html';
      }
    });
  }

  // Initial Load
  loadDeposits();
});