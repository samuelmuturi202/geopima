document.addEventListener('DOMContentLoaded', () => {

  // Live Table Search Filter Logic
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

  // Add Deposit Event Trigger
  const addDepositBtn = document.getElementById('add-deposit-btn');
  if (addDepositBtn) {
    addDepositBtn.addEventListener('click', () => {
      alert('Add Deposit action initiated.');
    });
  }

});