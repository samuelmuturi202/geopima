document.addEventListener('DOMContentLoaded', () => {

  // --- 1. Top Bar Menu Toggle Event ---
  const sidebarToggle = document.getElementById('toggle-sidebar');
  const sidebar = document.getElementById('sidebar');

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  // --- 2. Action Buttons Dropdowns Handler ---
  const setupDropdown = (buttonId, menuId) => {
    const btn = document.getElementById(buttonId);
    const menu = document.getElementById(menuId);
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const parent = btn.closest('.dropdown-container');
      
      // Close other open dropdowns
      document.querySelectorAll('.dropdown-container').forEach(c => {
        if (c !== parent) c.classList.remove('open');
      });

      parent.classList.toggle('open');
    });
  };

  setupDropdown('status-dropdown-btn', 'status-dropdown-menu');
  setupDropdown('export-dropdown-btn', 'export-dropdown-menu');

  // Close dropdowns on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-container').forEach(c => {
      c.classList.remove('open');
    });
  });

  // --- 3. Table Live Search Filtering ---
  const searchInput = document.getElementById('table-search');
  const tableRows = document.querySelectorAll('#landlords-table tbody tr');
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

  // --- 4. New Landlord Button Trigger ---
  const newLandlordBtn = document.getElementById('new-landlord-btn');
  if (newLandlordBtn) {
    newLandlordBtn.addEventListener('click', () => {
      alert('Open New Landlord Registration Form Modal');
    });
  }

});