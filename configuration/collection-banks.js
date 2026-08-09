document.addEventListener('DOMContentLoaded', () => {

  // Search Filter Implementation
  const searchInput = document.getElementById('banksSearch');
  const tableRows = document.querySelectorAll('.banks-table tbody tr');

  if (searchInput) {
    searchInput.addEventListener('keyup', (e) => {
      const term = e.target.value.toLowerCase();
      tableRows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }

  // Delete Bank Action
  document.querySelectorAll('.link-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const bankName = e.target.closest('tr').children[0].textContent;
      if (confirm(`Are you sure you want to delete the payment bank: "${bankName}"?`)) {
        e.target.closest('tr').remove();
      }
    });
  });

  // New Bank Modal Trigger
  const newBankBtn = document.querySelector('.btn-new-bank');
  if (newBankBtn) {
    newBankBtn.addEventListener('click', () => {
      alert('Open New Bank Modal');
    });
  }

});