// agency-profile.js
document.addEventListener('DOMContentLoaded', async () => {
  const profileForm = document.getElementById('agencyProfileForm');

  async function loadProfile() {
    try {
      const profile = await fetchAPI('/agency-profile/1/');
      if (profile && profileForm) {
        const companyName = document.getElementById('companyName');
        if (companyName) companyName.value = profile.company_name || '';
        const shortName = document.getElementById('shortName');
        if (shortName) shortName.value = profile.short_name || '';
        const email = document.getElementById('email');
        if (email) email.value = profile.email || '';
        const contact = document.getElementById('contact');
        if (contact) contact.value = profile.contact || '';
      }
    } catch (error) {
      console.error('Failed to load agency profile:', error);
    }
  }

  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const companyNameElem = document.getElementById('companyName');
      const companyName = companyNameElem ? companyNameElem.value : 'Pemwa Agency';
      const shortNameElem = document.getElementById('shortName');
      const emailElem = document.getElementById('email');
      const contactElem = document.getElementById('contact');

      const payload = {
        company_name: companyName,
        short_name: shortNameElem ? shortNameElem.value : '',
        email: emailElem ? emailElem.value : '',
        contact: contactElem ? contactElem.value : ''
      };

      try {
        await fetchAPI('/agency-profile/1/', {
          method: 'PUT',
          body: payload
        });
        alert(`Agency profile for "${companyName}" saved successfully!`);
      } catch (err) {
        alert('Failed to update agency profile: ' + err.message);
      }
    });
  }

  loadProfile();
});