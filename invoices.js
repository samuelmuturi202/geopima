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

  const tbody = document.getElementById('invoice-tbody');

  function renderRows(data) {
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding:15px;">No invoices found</td></tr>`;
      return;
    }

    data.forEach((item, index) => {
      const tr = document.createElement('tr');
      const isCleared = item.status === 'cleared' || item.is_cleared;
      const statusLabel = isCleared ? 'cleared' : 'not_cleared';
      const statusText = isCleared ? 'cleared' : 'not cleared';

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td><a href="#">${item.invoiceNo || item.invoice_number || ''}</a></td>
        <td><a href="#">${item.tnt || item.tenant_number || ''}</a></td>
        <td>${item.tenant || item.tenant_name || ''}</td>
        <td>${item.property || item.property_name || ''}</td>
        <td>${item.unit || item.unit_name || ''}</td>
        <td>${item.due || item.due_day || 5}</td>
        <td class="text-right">${Number(item.expected || item.expected_amount || 0).toLocaleString()}</td>
        <td class="text-right">${Number(item.prepaid || 0).toLocaleString()}</td>
        <td class="text-right">${Number(item.discount || 0).toLocaleString()}</td>
        <td class="text-right">${Number(item.arrears || 0).toLocaleString()}</td>
        <td class="text-right">${Number(item.current || item.current_amount || 0).toLocaleString()}</td>
        <td class="text-right">${Number(item.paid || item.paid_amount || 0).toLocaleString()}</td>
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
      renderRows(response.results || response);
    } catch (err) {
      console.error('Failed to fetch invoices from server:', err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; color:red; padding:15px;">Error fetching invoices from backend</td></tr>`;
      }
    }
  }

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