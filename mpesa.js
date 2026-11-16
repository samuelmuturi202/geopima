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
  let mpesaTransactions = [];

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
      if (!mpesaTransactions.length) {
        alert('There are no M-Pesa transactions to export.');
        return;
      }
      window.downloadCsv('mpesa-transactions.csv',
        ['Date', 'Transaction ID', 'Account', 'Tenant', 'Property', 'Unit', 'Payer', 'Amount', 'Status'],
        mpesaTransactions.map(item => [
          item.dateTime || item.created_at,
          item.transId || item.trans_id,
          item.accountNo || item.bill_ref_number,
          item.tenant || item.tenant_name,
          item.property || item.property_name,
          item.unit || item.unit_name,
          item.payer || item.first_name,
          item.amount || item.trans_amount,
          item.status || (item.is_settled ? 'successful' : 'unsuccessful')
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

  // 2. Fetch Transactions from Django Backend & Render Table
  const tableBody = document.getElementById('mpesa-table-body');
  const totalSummaryEl = document.getElementById('total-mpesa-summary');
  const statusFilterBtn = document.getElementById('filter-status-btn');
  const periodFilterBtn = document.getElementById('filter-period-btn');
  let selectedStatus = 'ALL';
  let selectedPeriod = 'ALL';

  function getTransactionStatus(item) {
    return item.status === 'successful' || item.status === 'SUCCESS' || item.is_settled === true
      ? 'successful'
      : 'unsuccessful';
  }

  function getTransactionPeriod(item) {
    const rawDate = String(item.dateTime || item.created_at || '').trim();
    const match = rawDate.match(/^(\d{4})[-/]?(\d{2})/);
    return match ? `${match[1]}-${match[2]}` : '';
  }

  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const visibleTransactions = (data || []).filter(item =>
      (selectedStatus === 'ALL' || getTransactionStatus(item) === selectedStatus)
      && (selectedPeriod === 'ALL' || getTransactionPeriod(item) === selectedPeriod)
    );

    if (!visibleTransactions.length) {
      tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 15px;">No MPESA transactions found</td></tr>`;
      if (totalSummaryEl) totalSummaryEl.textContent = 'KES. 0.00';
      return;
    }

    let runningTotal = 0;

    visibleTransactions.forEach((item, index) => {
      const amountVal = Number(item.amount || item.trans_amount || 0);
      runningTotal += amountVal;

      // Status logic: successful if smart alias matches a unit correctly, unsuccessful if unmapped/incorrect
      const isSuccessful = getTransactionStatus(item) === 'successful';
      const badgeClass = isSuccessful ? 'badge-successful' : 'badge-unsuccessful';
      const statusText = isSuccessful ? 'successful' : 'unsuccessful';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.id || index + 1}</td>
        <td>${item.dateTime || item.created_at || ''}</td>
        <td>${item.transId || item.trans_id || ''}</td>
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
      mpesaTransactions = transactions.results || transactions;
      const latestPeriod = mpesaTransactions.map(getTransactionPeriod).filter(Boolean).sort().pop();
      const summaryLabel = document.querySelector('.summary-label');
      if (summaryLabel && latestPeriod) {
        const [year, month] = latestPeriod.split('-');
        const monthName = new Date(Number(year), Number(month) - 1, 1)
          .toLocaleString(undefined, { month: 'long' }).toUpperCase();
        summaryLabel.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('MPESA PAYMENTS')) {
            node.textContent = ` ${monthName}-${year} MPESA PAYMENTS [ `;
          }
        });
      }
      renderTable(mpesaTransactions);
    } catch (error) {
      console.error('Failed to load MPESA payments:', error);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:red; padding:15px;">Error loading MPESA transactions from server.</td></tr>`;
      }
    }
  }

  if (statusFilterBtn) {
    statusFilterBtn.addEventListener('click', () => {
      const selected = prompt('Filter status: enter ALL, successful, or unsuccessful.', selectedStatus);
      if (selected === null) return;
      const normalized = selected.trim().toLowerCase();
      if (!['all', 'successful', 'unsuccessful'].includes(normalized)) {
        alert('Choose ALL, successful, or unsuccessful.');
        return;
      }
      selectedStatus = normalized.toUpperCase() === 'ALL' ? 'ALL' : normalized;
      renderTable(mpesaTransactions);
    });
  }
  if (periodFilterBtn) {
    periodFilterBtn.addEventListener('click', () => {
      const periods = [...new Set(mpesaTransactions.map(getTransactionPeriod).filter(Boolean))].sort().reverse();
      const selected = prompt(`Filter period (YYYY-MM) or ALL:\n${periods.join('\n')}`, selectedPeriod);
      if (selected === null) return;
      const normalized = selected.trim().toUpperCase() === 'ALL' ? 'ALL' : selected.trim();
      if (normalized !== 'ALL' && !periods.includes(normalized)) {
        alert('Choose a listed period or ALL.');
        return;
      }
      selectedPeriod = normalized;
      renderTable(mpesaTransactions);
    });
  }

  // 3. Action Button Event Listeners
  const confirmBtn = document.getElementById('confirm-multiple-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (confirm('Verify and reconcile pending transactions with backend?')) {
        try {
          const result = await fetchAPI('/mpesa/paybill-transactions/verify-batch/', { method: 'POST' });
          alert(`Reprocessed ${result.reprocessed_count || 0} pending transactions.`);
          await loadMpesaTransactions();
        } catch (err) {
          alert('Verification failed: ' + err.message);
        }
      }
    });
  }

  loadMpesaTransactions();
});