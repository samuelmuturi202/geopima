document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

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
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  }

  // 1. Upload Statement Action (Multipart Form Data Post)
  const uploadBtn = document.getElementById('upload-statement-btn');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.csv, .xlsx, .pdf, .txt';
      
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
  const paginationInfo = document.getElementById('pagination-info');

  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="10" class="empty-msg">No data available in table</td></tr>`;
      if (paginationInfo) paginationInfo.textContent = 'Showing 0 to 0 of 0 entries';
      return;
    }

    data.forEach((item, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
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
      paginationInfo.textContent = `Showing 1 to ${data.length} of ${data.length} entries`;
    }
  }

  async function loadCoopData(searchQuery = '') {
    try {
      const queryParam = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
      const response = await fetchAPI(`/billing/coop-statements/${queryParam}`);
      coopData = response.results || response;
      renderTable(coopData);
    } catch (err) {
      console.error('Failed to load Coop statement data:', err);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="10" class="empty-msg" style="color:red;">Error fetching records from backend</td></tr>`;
      }
    }
  }

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();
      debounceTimer = setTimeout(() => loadCoopData(query), 300);
    });
  }

  loadCoopData();
});