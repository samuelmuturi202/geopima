document.addEventListener('DOMContentLoaded', () => {

  // Add User Button Handler
  const openAddUserBtn = document.getElementById('openAddUserModal');
  if (openAddUserBtn) {
    openAddUserBtn.addEventListener('click', () => {
      alert('Add New User modal / form triggered.');
    });
  }

  // View Details Buttons Handler
  const detailButtons = document.querySelectorAll('.btn-view-details');
  detailButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.user-card');
      const userName = card.querySelector('.user-name-title').textContent;
      alert(`Opening details for user: ${userName}`);
    });
  });

});