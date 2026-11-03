document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'https://geopima.onrender.com/api/v1'; // Update to http://127.0.0.1:8000/api/v1 if testing locally

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
  let currentInvoices = [];
  let currentFilterStatus = 'ALL';
  let currentFilterProperty = 'ALL';
  let currentFilterCluster = 'ALL';
  let currentFilterPeriod = 'ALL';

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

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding:15px;">No invoices found</td></tr>`;
      return;
    }

    data.forEach((item, index) => {
      const balance = Number(item.balance || 0);
      const paid = Number(item.paid || item.rent_paid || 0);
      const expected = Number(item.expected || item.net_total || 0);
      const arrears = Number(item.arrears || 0);

      const isCleared = balance <= 0 || item.status === 'paid';
      const isOverpaid = balance < 0;
      const hasBalances = balance > 0;
      const hasArrears = arrears > 0;
      const isNotPaid = paid === 0;

      // Filter Logic Evaluation
      if (currentFilterProperty !== 'ALL' && item.property !== currentFilterProperty) return;
      if (currentFilterCluster !== 'ALL' && item.cluster !== currentFilterCluster) return;
      if (currentFilterPeriod !== 'ALL' && item.period !== currentFilterPeriod) return;

      if (currentFilterStatus === 'cleared' && !isCleared) return;
      if (currentFilterStatus === 'overpaid' && !isOverpaid) return;
      if (currentFilterStatus === 'with-balances' && !hasBalances) return;
      if (currentFilterStatus === 'with-arrears' && !hasArrears) return;
      if (currentFilterStatus === 'not-paid' && !isNotPaid) return;

      const statusLabel = isCleared ? 'cleared' : 'not-cleared';
      const statusText = isCleared ? 'cleared' : 'not cleared';

      const invoiceNo = item.invoice_no || item.invoice_number || 'INV000001';
      const invoiceId = item.id || index + 1;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td><a href="invoice.html?id=${invoiceId}">${invoiceNo}</a></td>
        <td><a href="#">${item.tnt || item.tenant_number || ''}</a></td>
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
  }

  async function loadInvoices(searchQuery = '') {
    try {
      const queryParam = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
      const response = await fetchAPI(`/billing/invoices/${queryParam}`);
      currentInvoices = response.results || response;
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

  const tenantsWithoutInvoicesBtn = document.getElementById('btn-tenants-without-invoices');
  if (tenantsWithoutInvoicesBtn) {
    tenantsWithoutInvoicesBtn.addEventListener('click', () => {
      alert('Fetching tenants who have not been invoiced for this period...');
    });
  }

  // CSV Export with Agency Profile Details
  document.getElementById('export-csv').addEventListener('click', (e) => {
    e.preventDefault();
    if (!currentInvoices.length) {
      alert('No data available to export.');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `"PEMWA AGENCY"\n`;
    csvContent += `"1254-00200, GPO Nairobi | Email: pemwaagency@yahoo.com"\n`;
    csvContent += `"Contact: 0725768616 | 0101768816"\n\n`;
    csvContent += `Invoice No,Tenant,Property,Unit,Expected,Paid,Balance,Status\n`;

    currentInvoices.forEach(inv => {
      csvContent += `"${inv.invoice_number || inv.invoice_no || ''}","${inv.tenant || ''}","${inv.property || ''}","${inv.unit || ''}",${inv.expected || 0},${inv.paid || 0},${inv.balance || 0},"${inv.status || ''}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "pemwa_agency_invoices.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Print / PDF Export Handler
  document.getElementById('export-print').addEventListener('click', (e) => {
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