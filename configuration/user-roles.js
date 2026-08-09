document.addEventListener('DOMContentLoaded', () => {

  // Search Filter Implementation
  const searchInput = document.getElementById('rolesSearch');
  const tableRows = document.querySelectorAll('.roles-table tbody tr');

  if (searchInput) {
    searchInput.addEventListener('keyup', (e) => {
      const term = e.target.value.toLowerCase();
      tableRows.forEach(row => {
        const roleName = row.querySelector('.role-name-text').textContent.toLowerCase();
        row.style.display = roleName.includes(term) ? '' : 'none';
      });
    });
  }

  // Set Permissions Action
  document.querySelectorAll('.btn-set-permissions').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const role = e.target.closest('tr').querySelector('.role-name-text').textContent;
      alert(`Managing permissions for role: ${role}`);
    });
  });

  // Edit Role Action
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const role = e.target.closest('tr').querySelector('.role-name-text').textContent;
      alert(`Editing role: ${role}`);
    });
  });

  // Delete Role Action
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const role = e.target.closest('tr').querySelector('.role-name-text').textContent;
      if (confirm(`Are you sure you want to delete the role "${role}"?`)) {
        e.target.closest('tr').remove();
      }
    });
  });

});