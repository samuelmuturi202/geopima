document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'https://geopima.onrender.com/api/v1';

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

  // 2. Fetch Transactions from Django Backend & Render Table
  const tableBody = document.getElementById('mpesa-table-body');
  const totalSummaryEl = document.getElementById('total-mpesa-summary');

  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 15px;">No MPESA transactions found</td></tr>`;
      return;
    }

    let runningTotal = 0;

    data.forEach((item, index) => {
      const amountVal = Number(item.amount || item.trans_amount || 0);
      runningTotal += amountVal;

      // Status logic: successful if smart alias matches a unit correctly, unsuccessful if unmapped/incorrect
      const isSuccessful = item.status === 'successful' || item.status === 'SUCCESS' || item.is_settled === true;
      const badgeClass = isSuccessful ? 'badge-successful' : 'badge-unsuccessful';
      const statusText = isSuccessful ? 'successful' : 'unsuccessful';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.id || index + 1}</td>
        <td>${item.dateTime || item.created_at || ''}</td>
        <td><a href="#" class="trans-link">${item.transId || item.trans_id || ''}</a></td>
        <td>${item.accountNo || item.bill_ref_number || ''}</td>
        <td>${item.tenant || item.tenant_name || ''}</td>
        <td>${item.property || item.property_name || ''}</td>
        <td>${item.unit || item.unit_name || ''}</td>
        <td>${item.payer || item.first_name || ''}</td>
        <td><strong>KES ${amountVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
      `;
      tableBody.appendChild(row);
    });

    if (totalSummaryEl) {
      totalSummaryEl.textContent = `KES. ${runningTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
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