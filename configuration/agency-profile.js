// agency-profile.js
document.addEventListener('DOMContentLoaded', async () => {
  const profileForm = document.getElementById('agencyProfileForm');

  async function loadProfile() {
    try {
      // Fetch agency profile from backend (using ID 1 or default endpoint)
      const profile = await fetchAPI('/agency-profile/1/');
      if (profile && profileForm) {
        setFieldValue('companyName', profile.company_name);
        setFieldValue('shortName', profile.short_name);
        setFieldValue('mottoSlogan', profile.motto_slogan);
        setFieldValue('contact', profile.contact);
        setFieldValue('contact2', profile.contact2);
        setFieldValue('email', profile.email);
        setFieldValue('physicalAddress', profile.physical_address);
        setFieldValue('postalAddress', profile.postal_address);
        setFieldValue('website', profile.website);
        
        const transitionSelect = document.getElementById('endMonthTransition');
        if (transitionSelect && profile.end_month_transition) {
          transitionSelect.value = profile.end_month_transition;
        }
      }
    } catch (error) {
      console.error('Failed to load agency profile:', error);
    }
  }

  function setFieldValue(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) {
      el.value = val;
    }
  }

  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const companyName = document.getElementById('companyName')?.value || 'Pemwa Agency';
      const shortName = document.getElementById('shortName')?.value || '';
      const mottoSlogan = document.getElementById('mottoSlogan')?.value || '';
      const contact = document.getElementById('contact')?.value || '';
      const contact2 = document.getElementById('contact2')?.value || '';
      const email = document.getElementById('email')?.value || '';
      const physicalAddress = document.getElementById('physicalAddress')?.value || '';
      const postalAddress = document.getElementById('postalAddress')?.value || '';
      const website = document.getElementById('website')?.value || '';
      const endMonthTransition = document.getElementById('endMonthTransition')?.value || 'auto';

      const payload = {
        company_name: companyName,
        short_name: shortName,
        motto_slogan: mottoSlogan,
        contact: contact,
        contact2: contact2,
        email: email,
        physical_address: physicalAddress,
        postal_address: postalAddress,
        website: website,
        end_month_transition: endMonthTransition
      };

      try {
        await fetchAPI('/agency-profile/1/', {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        alert(`Agency profile for "${companyName}" saved successfully!`);
      } catch (err) {
        console.error('Failed to update agency profile:', err);
        alert('Failed to update agency profile: ' + (err.message || 'Server error'));
      }
    });
  }

  loadProfile();
});