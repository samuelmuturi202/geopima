document.addEventListener('DOMContentLoaded', () => {

  // Export Dropdown Interactivity
  const exportBtn = document.getElementById('export-btn');
  const exportContainer = exportBtn ? exportBtn.closest('.dropdown-container') : null;

  if (exportBtn && exportContainer) {
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportContainer.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      exportContainer.classList.remove('open');
    });
  }

  // Client-side Search Filtering
  const searchInput = document.getElementById('table-search');
  const tableRows = document.querySelectorAll('#properties-table tbody tr');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();

      tableRows.forEach(row => {
        const textContent = row.textContent.toLowerCase();
        if (textContent.includes(searchTerm)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
  }

});