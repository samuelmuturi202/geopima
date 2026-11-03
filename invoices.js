document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'https://geopima.onrender.com/api/v1'; // Update to http://127.0.0.1:8000/api/v1 if testing locally[cite: 5]

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

  function renderRows(data) {
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding:15px;">No invoices found</td></tr>`;
      return;
    }

    data.forEach((item, index) => {
      const isCleared = item.status === 'paid' || item.is_cleared || Number(item.balance || 0) <= 0;
      const statusLabel = isCleared ? 'cleared' : 'not-cleared';
      const statusText = isCleared ? 'cleared' : 'not cleared';

      if (currentFilterStatus === 'cleared' && !isCleared) return;
      if (currentFilterStatus === 'not-cleared' && isCleared) return;
      if (currentFilterProperty !== 'ALL' && item.property !== currentFilterProperty) return;

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
        <td class="text-right">${Number(item.expected || item.expected_amount || 0).toLocaleString()}</td>
        <td class="text-right">${Number(item.prepaid || 0).toLocaleString()}</td>
        <td class="text-right">${Number(item.discount || 0).toLocaleString()}</td>
        <td class="text-right">${Number(item.arrears || 0).toLocaleString()}</td>
        <td class="text-right">${Number(item.current || item.net_total || 0).toLocaleString()}</td>
        <td class="text-right">${Number(item.paid || item.rent_paid || 0).toLocaleString()}</td>
        <td class="text-right">${Number(item.balance || 0).toLocaleString()}</td>
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

  // Interactive Dropdown Filters
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

  document.querySelectorAll('#dropdown-period-menu a').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const period = e.target.getAttribute('data-period');
      document.getElementById('panel-title-period').textContent = `${period} INVOICES LIST`;
      loadInvoices();
    });
  });

  document.querySelectorAll('#dropdown-status-menu a').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      currentFilterStatus = e.target.getAttribute('data-status');
      renderRows(currentInvoices);
    });
  });

  document.querySelectorAll('#dropdown-property-menu a').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      currentFilterProperty = e.target.getAttribute('data-property');
      renderRows(currentInvoices);
    });
  });

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

  loadInvoices();
});