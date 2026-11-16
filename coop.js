document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'https://geopima.onrender.com/api/v1';

  async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');
    const headers = {
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

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

  // 1. Upload Statement Action (Multipart Form Data Post)
  const uploadBtn = document.getElementById('upload-statement-btn');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.csv';
      
      fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          const formData = new FormData();
          formData.append('statement', file);

          try {
            uploadBtn.disabled = true;
            uploadBtn.innerText = 'Uploading...';

            await fetchAPI('/billing/coop-statements/upload/', {
              method: 'POST',
              body: formData
            });

            alert(`Coop statement "${file.name}" uploaded successfully!`);
            loadCoopData();
          } catch (err) {
            alert(`Failed to upload statement: ${err.message}`);
          } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerText = 'Upload Statement';
          }
        }
      };
      fileInput.click();
    });
  }

  // 2. Table State & Search Management
  let coopData = [];
  const tableBody = document.getElementById('coop-table-body');
  const searchInput = document.getElementById('search-input');
  const entriesSelect = document.getElementById('entries-select');
  const paginationInfo = document.getElementById('pagination-info');
  const previousBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const periodFilterBtn = document.getElementById('filter-period-btn');
  const totalAmount = document.querySelector('.amount-highlight');
  let visibleData = [];
  let selectedPeriod = 'ALL';
  let currentPage = 1;
  let rowsPerPage = Number(entriesSelect?.value || 10);

  function getPeriod(item) {
    const date = String(item.date || item.created_at || '').trim();
    const match = date.match(/^(\d{4})[-/]?(\d{2})/);
    return match ? `${match[1]}-${match[2]}` : '';
  }

  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
      currentPage = 1;
      tableBody.innerHTML = `<tr><td colspan="10" class="empty-msg">No data available in table</td></tr>`;
      if (paginationInfo) paginationInfo.textContent = 'Showing 0 to 0 of 0 entries';
      if (totalAmount) totalAmount.textContent = 'KES. 0.00';
      updatePagination(0);
      return;
    }

    const pageCount = Math.ceil(data.length / rowsPerPage);
    currentPage = Math.min(currentPage, pageCount);
    const start = (currentPage - 1) * rowsPerPage;
    data.slice(start, start + rowsPerPage).forEach((item, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${start + index + 1}</td>
        <td>${item.date || item.created_at || ''}</td>
        <td>${item.code || item.transaction_code || ''}</td>
        <td>${item.tenantNo || item.tenant_number || ''}</td>
        <td>${item.tenant || item.tenant_name || ''}</td>
        <td>${item.phone || ''}</td>
        <td>${item.paidBy || item.payer_name || ''}</td>
        <td>${item.paymentRef || item.reference || ''}</td>
        <td>${item.narration || ''}</td>
        <td><strong>KES ${Number(item.amount || 0).toLocaleString()}</strong></td>
      `;
      tableBody.appendChild(row);
    });

    if (paginationInfo) {
      paginationInfo.textContent = `Showing ${start + 1} to ${Math.min(start + rowsPerPage, data.length)} of ${data.length} entries`;
    }
    if (totalAmount) {
      const total = data.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      totalAmount.textContent = `KES. ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  function applyFilters() {
    const query = searchInput?.value.trim().toLowerCase() || '';
    visibleData = coopData.filter(item => {
      const periodMatches = selectedPeriod === 'ALL' || getPeriod(item) === selectedPeriod;
      const searchMatches = !query || Object.values(item).some(value =>
        String(value ?? '').toLowerCase().includes(query)
      );
      return periodMatches && searchMatches;
    });
    currentPage = 1;
    renderTable(visibleData);
  }

  async function loadCoopData(searchQuery = '') {
    try {
      const response = await fetchAPI('/billing/coop-statements/');
      coopData = response.results || response;
      applyFilters();
    } catch (err) {
      console.error('Failed to load Coop statement data:', err);
      if (tableBody) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 10;
        cell.className = 'empty-msg';
        cell.style.color = 'red';
        cell.textContent = `Error fetching records: ${err.message}`;
        row.appendChild(cell);
        tableBody.replaceChildren(row);
      }
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }
  if (entriesSelect) {
    entriesSelect.addEventListener('change', () => {
      rowsPerPage = Number(entriesSelect.value);
      currentPage = 1;
      renderTable(visibleData);
    });
  }
  if (previousBtn) {
    previousBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage -= 1;
        renderTable(visibleData);
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentPage < Math.ceil(visibleData.length / rowsPerPage)) {
        currentPage += 1;
        renderTable(visibleData);
      }
    });
  }
  if (periodFilterBtn) {
    periodFilterBtn.addEventListener('click', () => {
      const periods = [...new Set(coopData.map(getPeriod).filter(Boolean))].sort().reverse();
      const selected = prompt(`Filter period (YYYY-MM) or ALL:\n${periods.join('\n')}`, selectedPeriod);
      if (selected === null) return;
      const normalized = selected.trim().toUpperCase() === 'ALL' ? 'ALL' : selected.trim();
      if (normalized !== 'ALL' && !periods.includes(normalized)) {
        alert('Choose a listed period or ALL.');
        return;
      }
      selectedPeriod = normalized;
      applyFilters();
    });
  }

  loadCoopData();
});