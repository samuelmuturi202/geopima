document.addEventListener('DOMContentLoaded', () => {

  // 1. Sidebar Toggle & Finance Menu
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

  // 2. Export Button Dropdown Logic
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
      alert('Downloading Discounts report as Excel (.xlsx)...');
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      exportDropdown.classList.remove('active');
      alert('Downloading Discounts report as PDF (.pdf)...');
    });
  }

  // 3. Table Data Rendering Logic
  const discountData = []; // Default empty set matching screenshot

  const tableBody = document.getElementById('discounts-table-body');
  const searchInput = document.getElementById('search-input');
  const paginationInfo = document.getElementById('pagination-info');

  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="11" class="empty-msg">No data available in table</td></tr>`;
      if (paginationInfo) paginationInfo.textContent = 'Showing 0 to 0 of 0 entries';
      return;
    }

    data.forEach((item, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${item.invoice}</td>
        <td>${item.landlordName}</td>
        <td>${item.propertyName}</td>
        <td>${item.unitName}</td>
        <td>${item.tenantId}</td>
        <td>${item.tenantName}</td>
        <td>${item.discountName}</td>
        <td>${item.description}</td>
        <td>KES ${item.discount.toLocaleString()}</td>
        <td>${item.details}</td>
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
      const filtered = discountData.filter(item => 
        item.tenantName.toLowerCase().includes(query) ||
        item.propertyName.toLowerCase().includes(query) ||
        item.discountName.toLowerCase().includes(query)
      );
      renderTable(filtered);
    });
  }

  // Render initial table state
  renderTable(discountData);

});