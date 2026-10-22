document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

  // Helper for authenticated requests
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
      window.open(`${API_BASE_URL}/mpesa/paybill-transactions/export/?format=excel`, '_blank');
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      exportDropdown.classList.remove('active');
      window.open(`${API_BASE_URL}/mpesa/paybill-transactions/export/?format=pdf`, '_blank');
    });
  }

  // 2. Fetch Transactions from Django Backend
  const tableBody = document.getElementById('mpesa-table-body');

  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 15px;">No MPESA transactions found</td></tr>`;
      return;
    }

    data.forEach((item, index) => {
      const badgeClass = item.status === 'successful' || item.status === 'SUCCESS' ? 'badge-successful' : 'badge-unsuccessful';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.id || index + 1}</td>
        <td>${item.dateTime || item.created_at || ''}</td>
        <td><a href="#" class="trans-link">${item.transId || item.transaction_id || ''}</a></td>
        <td>${item.accountNo || item.account_number || ''}</td>
        <td>${item.tenant || item.tenant_name || ''}</td>
        <td>${item.property || item.property_name || ''}</td>
        <td>${item.unit || item.unit_name || ''}</td>
        <td>${item.payer || item.payer_name || ''}</td>
        <td><strong>KES ${Number(item.amount).toLocaleString()}</strong></td>
        <td><span class="badge ${badgeClass}">${item.status}</span></td>
      `;
      tableBody.appendChild(row);
    });
  }

  async function loadMpesaTransactions() {
    try {
      const transactions = await fetchAPI('/mpesa/paybill-transactions/');
      renderTable(transactions.results || transactions);
    } catch (error) {
      console.error('Failed to load MPESA payments:', error);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:red; padding:15px;">Error loading MPESA transactions from server.</td></tr>`;
      }
    }
  }

  // 3. Action Button Event Listeners
  const confirmBtn = document.getElementById('confirm-multiple-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (confirm('Verify and reconcile pending transactions with backend?')) {
        try {
          await fetchAPI('/mpesa/paybill-transactions/verify-batch/', { method: 'POST' });
          alert('Batch transaction verification completed.');
          loadMpesaTransactions();
        } catch (err) {
          alert('Verification failed: ' + err.message);
        }
      }
    });
  }

  loadMpesaTransactions();
});