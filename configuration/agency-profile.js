document.addEventListener('DOMContentLoaded', () => {

  const profileForm = document.getElementById('agencyProfileForm');

  profileForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const companyName = document.getElementById('companyName').value;

    // Trigger save feedback
    alert(`Agency profile for "${companyName}" saved successfully!`);
  });

});