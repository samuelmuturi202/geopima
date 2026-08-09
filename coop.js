document.addEventListener('DOMContentLoaded', () => {

  // 1. Sidebar Toggle & Dropdown Controls
  const toggleBtn = document.getElementById('toggle-sidebar');
  const sidebar = document.getElementById('sidebar');
  const financeBtn = document.getElementById('finance-dropdown-toggle');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  if (financeBtn) {
    financeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dropdown = financeBtn.closest('.nav-dropdown');
      if (dropdown) dropdown.classList.toggle('open');
    });
  }

  // 2. Upload Statement Action
  const uploadBtn = document.getElementById('upload-statement-btn');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      // Create hidden file input dynamically
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.csv, .xlsx, .pdf, .txt';
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          alert(`Selected Coop statement: ${file.name}\nProcessing statement upload...`);
        }
      };
      fileInput.click();
    });
  }

  // 3. Table State & Search Management
  const coopData = []; // Currently empty matching screenshot

  const tableBody = document.getElementById('coop-table-body');
  const searchInput = document.getElementById('search-input');
  const paginationInfo = document.getElementById('pagination-info');

  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="10" class="empty-msg">No data available in table</td></tr>`;
      if (paginationInfo) paginationInfo.textContent = 'Showing 0 to 0 of 0 entries';
      return;
    }

    data.forEach((item, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${item.date}</td>
        <td>${item.code}</td>
        <td>${item.tenantNo}</td>
        <td>${item.tenant}</td>
        <td>${item.phone}</td>
        <td>${item.paidBy}</td>
        <td>${item.paymentRef}</td>
        <td>${item.narration}</td>
        <td>KES ${item.amount.toLocaleString()}</td>
      `;
      tableBody.appendChild(row);
    });

    if (paginationInfo) {
      paginationInfo.textContent = `Showing 1 to ${data.length} of ${data.length} entries`;
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const filtered = coopData.filter(item => 
        item.tenant.toLowerCase().includes(query) ||
        item.code.toLowerCase().includes(query) ||
        item.paymentRef.toLowerCase().includes(query)
      );
      renderTable(filtered);
    });
  }

  // Initial Table Load
  renderTable(coopData);

});