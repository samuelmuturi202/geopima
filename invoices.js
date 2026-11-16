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

  const tbody = document.getElementById('invoice-tbody');
  const entriesSelect = document.getElementById('entries-select');
  const pageInfo = document.getElementById('invoice-page-info');
  const previousBtn = document.getElementById('invoice-prev-btn');
  const nextBtn = document.getElementById('invoice-next-btn');
  let currentInvoices = [];
  let currentFilterStatus = 'ALL';
  let currentFilterProperty = 'ALL';
  let currentFilterCluster = 'ALL';
  let currentFilterPeriod = 'ALL';
  let rowsPerPage = Number(entriesSelect?.value || 25);
  let currentPage = 1;

  // Automated Scrollable Period Generator (From August 2025 onwards)
  function populatePeriodDropdown() {
    const periodMenu = document.getElementById('dropdown-period-menu');
    if (!periodMenu) return;
    
    periodMenu.innerHTML = '<a href="#" data-period="ALL">ALL PERIODS</a>';
    
    const startDate = new Date(2025, 7, 1); // August 2025
    const currentDate = new Date();
    const endDate = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1);

    let iterDate = new Date(startDate);
    while (iterDate <= endDate) {
      const monthName = iterDate.toLocaleString('default', { month: 'long' }).toUpperCase();
      const year = iterDate.getFullYear();
      const periodKey = `${monthName}-${year}`;
      
      const a = document.createElement('a');
      a.href = '#';
      a.setAttribute('data-period', periodKey);
      a.textContent = periodKey;
      periodMenu.appendChild(a);

      iterDate.setMonth(iterDate.getMonth() + 1);
    }
  }

  // Populate Property Names from Database API
  async function populatePropertyDropdown() {
    try {
      const response = await fetchAPI('/properties/');
      const properties = response.results || response;
      const propertyMenu = document.getElementById('dropdown-property-menu');
      if (!propertyMenu) return;

      propertyMenu.innerHTML = '<a href="#" data-property="ALL">ALL PROPERTIES</a>';
      
      properties.forEach(prop => {
        const propName = prop.name || prop.property_name;
        if (propName) {
          const a = document.createElement('a');
          a.href = '#';
          a.setAttribute('data-property', propName);
          a.textContent = propName;
          propertyMenu.appendChild(a);
        }
      });
      bindPropertyListeners();
    } catch (err) {
      console.error('Failed to load property filter options:', err);
    }
  }

  function renderRows(data) {
    if (!tbody) return;
    tbody.innerHTML = '';

    const filteredData = (data || []).filter(item => {
      const balance = Number(item.balance || 0);
      const paid = Number(item.paid || item.rent_paid || 0);
      const arrears = Number(item.arrears || 0);
      const isCleared = balance <= 0 || item.status === 'paid';
      const isOverpaid = balance < 0;
      const hasBalances = balance > 0;
      const hasArrears = arrears > 0;
      const isNotPaid = paid === 0;

      return (currentFilterProperty === 'ALL' || item.property === currentFilterProperty)
        && (currentFilterCluster === 'ALL' || item.cluster === currentFilterCluster)
        && (currentFilterPeriod === 'ALL' || item.period === currentFilterPeriod)
        && (currentFilterStatus !== 'cleared' || isCleared)
        && (currentFilterStatus !== 'overpaid' || isOverpaid)
        && (currentFilterStatus !== 'with-balances' || hasBalances)
        && (currentFilterStatus !== 'with-arrears' || hasArrears)
        && (currentFilterStatus !== 'not-paid' || isNotPaid);
    });

    if (!filteredData.length) {
      currentPage = 1;
      tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding:15px;">No invoices found</td></tr>`;
      if (pageInfo) pageInfo.textContent = 'Showing 0 to 0 of 0 entries';
      updatePagination(0);
      return;
    }

    const pageCount = Math.ceil(filteredData.length / rowsPerPage);
    currentPage = Math.min(currentPage, pageCount);
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = filteredData.slice(start, start + rowsPerPage);
    pageData.forEach((item, index) => {
      const balance = Number(item.balance || 0);
      const paid = Number(item.paid || item.rent_paid || 0);
      const expected = Number(item.expected || item.net_total || 0);
      const arrears = Number(item.arrears || 0);

      const isCleared = balance <= 0 || item.status === 'paid';

      const statusLabel = isCleared ? 'cleared' : 'not-cleared';
      const statusText = isCleared ? 'cleared' : 'not cleared';

      const invoiceNo = item.invoice_no || item.invoice_number || 'INV000001';
      const invoiceId = item.id || start + index + 1;
      const tenantId = item.tnt || item.tenant_number;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${start + index + 1}</td>
        <td><a href="invoice.html?id=${invoiceId}">${invoiceNo}</a></td>
        <td>${tenantId ? `<a href="tenant-detail.html?id=${encodeURIComponent(tenantId)}">${tenantId}</a>` : ''}</td>
        <td>${item.tenant || item.tenant_name || ''}</td>
        <td>${item.property || item.property_name || ''}</td>
        <td>${item.unit || item.unit_name || ''}</td>
        <td>${item.due || item.due_day || 5}</td>
        <td class="text-right">${expected.toLocaleString()}</td>
        <td class="text-right">${Number(item.prepaid || 0).toLocaleString()}</td>
        <td class="text-right">${Number(item.discount || 0).toLocaleString()}</td>
        <td class="text-right">${arrears.toLocaleString()}</td>
        <td class="text-right">${Number(item.current || item.net_total || 0).toLocaleString()}</td>
        <td class="text-right">${paid.toLocaleString()}</td>
        <td class="text-right">${balance.toLocaleString()}</td>
        <td><span class="status-pill ${statusLabel}">${statusText}</span></td>
      `;
      tbody.appendChild(tr);
    });
    if (pageInfo) {
      pageInfo.textContent = `Showing ${start + 1} to ${Math.min(start + rowsPerPage, filteredData.length)} of ${filteredData.length} entries`;
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

  async function loadInvoices(searchQuery = '') {
    try {
      const queryParam = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
      const response = await fetchAPI(`/billing/invoices/${queryParam}`);
      currentInvoices = response.results || response;
      currentPage = 1;
      renderRows(currentInvoices);
    } catch (err) {
      console.error('Failed to fetch invoices from server:', err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; color:red; padding:15px;">Error fetching invoices from backend</td></tr>`;
      }
    }
  }

  // Dropdown Toggles
  document.querySelectorAll('.dropdown-container button').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdownMenu = button.nextElementSibling;
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu !== dropdownMenu) menu.classList.remove('show');
      });
      dropdownMenu.classList.toggle('show');
    });
  });

  window.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
  });

  // Filter Click Listeners
  document.addEventListener('click', (e) => {
    if (e.target && e.target.matches('#dropdown-period-menu a')) {
      e.preventDefault();
      currentFilterPeriod = e.target.getAttribute('data-period');
      document.getElementById('panel-title-period').textContent = `${currentFilterPeriod} INVOICES LIST`;
      renderRows(currentInvoices);
    }
  });

  document.querySelectorAll('#dropdown-status-menu a').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      currentFilterStatus = e.target.getAttribute('data-status');
      renderRows(currentInvoices);
    });
  });

  document.querySelectorAll('#dropdown-cluster-menu a').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      currentFilterCluster = e.target.getAttribute('data-cluster');
      renderRows(currentInvoices);
    });
  });

  function bindPropertyListeners() {
    document.querySelectorAll('#dropdown-property-menu a').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        currentFilterProperty = e.target.getAttribute('data-property');
        renderRows(currentInvoices);
      });
    });
  }

  if (entriesSelect) {
    entriesSelect.addEventListener('change', () => {
      rowsPerPage = Number(entriesSelect.value);
      currentPage = 1;
      renderRows(currentInvoices);
    });
  }
  if (previousBtn) {
    previousBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage -= 1;
        renderRows(currentInvoices);
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentPage < Math.ceil(currentInvoices.length / rowsPerPage)) {
        currentPage += 1;
        renderRows(currentInvoices);
      }
    });
  }

  const tenantsWithoutInvoicesBtn = document.getElementById('btn-tenants-without-invoices');
  if (tenantsWithoutInvoicesBtn) {
    tenantsWithoutInvoicesBtn.addEventListener('click', async () => {
      try {
        const period = currentFilterPeriod === 'ALL'
          ? 'ALL'
          : currentFilterPeriod.charAt(0) + currentFilterPeriod.slice(1).toLowerCase();
        const tenants = await fetchAPI(
          `/billing/invoices/tenants-without-invoices/?period=${encodeURIComponent(period)}`
        );
        const names = tenants.map(tenant =>
          `${tenant.tenant_id} — ${tenant.tenant_name} (${tenant.property_name}, ${tenant.unit_name})`
        );
        alert(names.length
          ? `Tenants without an invoice for ${tenants[0].billing_period}:\n\n${names.join('\n')}`
          : 'All active tenants have an invoice for the selected period.');
      } catch (error) {
        alert(`Could not load tenants without invoices: ${error.message}`);
      }
    });
  }

  // CSV Export with Agency Profile Details
  const exportCsvBtn = document.getElementById('export-csv');
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!currentInvoices.length) {
      alert('No data available to export.');
      return;
    }

    window.downloadCsv('invoices.csv',
      ['Invoice No', 'Tenant', 'Property', 'Unit', 'Expected', 'Paid', 'Balance', 'Status'],
      currentInvoices.map(inv => [
        inv.invoice_number || inv.invoice_no,
        inv.tenant,
        inv.property,
        inv.unit,
        inv.expected || 0,
        inv.paid || 0,
        inv.balance || 0,
        inv.status
      ])
    );
  });

  // Print / PDF Export Handler
  const exportPrintBtn = document.getElementById('export-print');
  if (exportPrintBtn) exportPrintBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.print();
  });

  // Real-time Search Filter
  const searchInput = document.getElementById('table-search');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();
      debounceTimer = setTimeout(() => loadInvoices(query), 300);
    });
  }

  // Initialize Data & Dropdowns
  populatePeriodDropdown();
  populatePropertyDropdown();
  loadInvoices();
});