document.addEventListener('DOMContentLoaded', () => {

  // --- 1. Sidebar Toggle Handler ---
  const sidebarToggle = document.getElementById('toggle-sidebar');
  const sidebar = document.getElementById('sidebar');

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  // --- 2. Collapsible Dropdown Handler ---
  const setupDropdownToggle = (toggleId) => {
    const toggleBtn = document.getElementById(toggleId);
    const dropdown = toggleBtn ? toggleBtn.closest('.nav-dropdown') : null;

    if (toggleBtn && dropdown) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        dropdown.classList.toggle('open');
      });
    }
  };

  setupDropdownToggle('finance-dropdown-toggle');
  setupDropdownToggle('fees-dropdown-toggle');

  // --- 3. Live Table Search Filter ---
  const searchInput = document.getElementById('table-search');
  const tableRows = document.querySelectorAll('#deposits-table tbody tr');
  const tableInfo = document.getElementById('table-info');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase().trim();
      let visibleRows = 0;

      tableRows.forEach(row => {
        const rowText = row.textContent.toLowerCase();
        if (rowText.includes(query)) {
          row.style.display = '';
          visibleRows++;
        } else {
          row.style.display = 'none';
        }
      });

      if (tableInfo) {
        tableInfo.textContent = `Showing 1 to ${visibleRows} of ${tableRows.length} entries`;
      }
    });
  }

  // --- 4. Add Deposit Trigger ---
  const addDepositBtn = document.getElementById('add-deposit-btn');
  if (addDepositBtn) {
    addDepositBtn.addEventListener('click', () => {
      alert('Add Deposit modal dialog will open.');
    });
  }

});