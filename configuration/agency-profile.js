// agency-profile.js
document.addEventListener('DOMContentLoaded', () => {
  // Tab Switching Logic
  const tabLinks = document.querySelectorAll('.sub-nav-tabs .sub-nav-link');
  const tabContents = document.querySelectorAll('.config-tab-content');

  tabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      tabLinks.forEach(l => l.classList.remove('active'));
      tabContents.forEach(c => c.style.display = 'none');

      link.classList.add('active');
      const targetTabId = link.getAttribute('data-tab');
      document.getElementById(targetTabId).style.display = 'block';
    });
  });

  // --- Live Preview Elements Binding ---
  const companyNameInput = document.getElementById('companyName');
  const mottoSloganInput = document.getElementById('mottoSlogan');
  const previewCompanyName = document.getElementById('previewCompanyName');
  const previewMottoSlogan = document.getElementById('previewMottoSlogan');
  const logoPreviewContainer = document.getElementById('logoPreviewContainer');
  const companyLogoInput = document.getElementById('companyLogo');

  if (companyNameInput && previewCompanyName) {
    companyNameInput.addEventListener('input', (e) => {
      previewCompanyName.textContent = e.target.value.trim() || 'AGENCY NAME';
    });
  }

  if (mottoSloganInput && previewMottoSlogan) {
    mottoSloganInput.addEventListener('input', (e) => {
      previewMottoSlogan.textContent = e.target.value.trim();
    });
  }

  if (companyLogoInput && logoPreviewContainer) {
    companyLogoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(uploadEvent) {
          logoPreviewContainer.innerHTML = `<img src="${uploadEvent.target.result}" alt="Company Logo" style="max-height: 70px; max-width: 150px; object-fit: contain;">`;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // --- 1. Agency Profile Form Logic (Supports Multipart File Uploads) ---
  const profileForm = document.getElementById('agencyProfileForm');
  async function loadAgencyProfile() {
    try {
      const data = await fetchAPI('/agency-profile/1/');
      if (data && profileForm) {
        document.getElementById('companyName').value = data.company_name || '';
        document.getElementById('shortName').value = data.short_name || '';
        document.getElementById('mottoSlogan').value = data.motto_slogan || '';
        document.getElementById('contact').value = data.contact || '';
        document.getElementById('contact2').value = data.contact2 || '';
        document.getElementById('email').value = data.email || '';
        document.getElementById('physicalAddress').value = data.physical_address || '';
        document.getElementById('postalAddress').value = data.postal_address || '';
        document.getElementById('website').value = data.website || '';
        if (data.end_month_transition) document.getElementById('endMonthTransition').value = data.end_month_transition;

        // Update live preview fields on load
        if (previewCompanyName) previewCompanyName.textContent = data.company_name || 'AGENCY NAME';
        if (previewMottoSlogan) previewMottoSlogan.textContent = data.motto_slogan || '';

        // Render logo if already exists in backend
        if (data.logo && logoPreviewContainer) {
          logoPreviewContainer.innerHTML = `<img src="${data.logo}" alt="Company Logo" style="max-height: 70px; max-width: 150px; object-fit: contain;">`;
        }
      }
    } catch (err) { console.error('Failed to load agency profile', err); }
  }

  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData();
      formData.append('company_name', document.getElementById('companyName').value);
      formData.append('short_name', document.getElementById('shortName').value);
      formData.append('motto_slogan', document.getElementById('mottoSlogan').value);
      formData.append('contact', document.getElementById('contact').value);
      formData.append('contact2', document.getElementById('contact2').value);
      formData.append('email', document.getElementById('email').value);
      formData.append('physical_address', document.getElementById('physicalAddress').value);
      formData.append('postal_address', document.getElementById('postalAddress').value);
      formData.append('website', document.getElementById('website').value);
      formData.append('end_month_transition', document.getElementById('endMonthTransition').value);

      const logoFile = document.getElementById('companyLogo').files[0];
      if (logoFile) {
        formData.append('logo', logoFile);
      }

      try {
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        const response = await fetch('/api/v1/agency-profile/1/', {
          method: 'PUT',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: formData
        });

        if (!response.ok) throw new Error('Failed to update agency profile');
        alert('Agency Profile saved successfully!');
        loadAgencyProfile();
      } catch (err) { alert('Error saving profile: ' + err.message); }
    });
  }

  // --- 2. Messenger Configs Form Logic ---
  const messengerForm = document.getElementById('messengerForm');
  async function loadMessengerConfig() {
    try {
      const data = await fetchAPI('/messenger-configs/1/');
      if (data && messengerForm) {
        document.getElementById('serviceProvider').value = data.service_provider || '';
        document.getElementById('senderId').value = data.sender_id || '';
        document.getElementById('partnerId').value = data.partner_id || '';
        document.getElementById('partnerKey').value = data.partner_key || '';
        document.getElementById('agencyPhone').value = data.agency_phone || '';
        document.getElementById('notifyTenant').checked = data.notify_tenant ?? true;
      }
    } catch (err) { console.error('Failed to load messenger configs', err); }
  }

  if (messengerForm) {
    messengerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        service_provider: document.getElementById('serviceProvider').value,
        sender_id: document.getElementById('senderId').value,
        partner_id: document.getElementById('partnerId').value,
        partner_key: document.getElementById('partnerKey').value,
        agency_phone: document.getElementById('agencyPhone').value,
        notify_tenant: document.getElementById('notifyTenant').checked
      };
      try {
        await fetchAPI('/messenger-configs/1/', { method: 'PUT', body: JSON.stringify(payload) });
        alert('Messenger Configurations saved successfully!');
      } catch (err) { alert('Error saving configurations: ' + err.message); }
    });
  }

  // --- 3. Mailer Configs Form Logic ---
  const mailerForm = document.getElementById('mailerForm');
  async function loadMailerConfig() {
    try {
      const data = await fetchAPI('/mailer-configs/1/');
      if (data && mailerForm) {
        document.getElementById('smtpHost').value = data.smtp_host || '';
        document.getElementById('smtpPort').value = data.smtp_port || '';
        document.getElementById('smtpEncryption').value = data.smtp_encryption || 'tls';
        document.getElementById('smtpUsername').value = data.smtp_username || '';
        document.getElementById('smtpPassword').value = data.smtp_password || '';
        document.getElementById('billingDisplayName').value = data.billing_display_name || '';
        document.getElementById('billingEmail').value = data.billing_email || '';
        document.getElementById('infoDisplayName').value = data.info_display_name || '';
        document.getElementById('infoEmail').value = data.info_email || '';
      }
    } catch (err) { console.error('Failed to load mailer configs', err); }
  }

  if (mailerForm) {
    mailerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        smtp_host: document.getElementById('smtpHost').value,
        smtp_port: document.getElementById('smtpPort').value,
        smtp_encryption: document.getElementById('smtpEncryption').value,
        smtp_username: document.getElementById('smtpUsername').value,
        smtp_password: document.getElementById('smtpPassword').value,
        billing_display_name: document.getElementById('billingDisplayName').value,
        billing_email: document.getElementById('billingEmail').value,
        info_display_name: document.getElementById('infoDisplayName').value,
        info_email: document.getElementById('infoEmail').value
      };
      try {
        await fetchAPI('/mailer-configs/1/', { method: 'PUT', body: JSON.stringify(payload) });
        alert('Mailer Configurations saved successfully!');
      } catch (err) { alert('Error saving configurations: ' + err.message); }
    });
  }

  // --- 4. Mpesa Configs Form Logic ---
  const mpesaForm = document.getElementById('mpesaForm');
  async function loadMpesaConfig() {
    try {
      const data = await fetchAPI('/mpesa-configs/1/');
      if (data && mpesaForm) {
        document.getElementById('shortcode').value = data.shortcode || '';
        document.getElementById('consumerKey').value = data.consumer_key || '';
        document.getElementById('consumerSecret').value = data.consumer_secret || '';
        document.getElementById('passKey').value = data.pass_key || '';
        document.getElementById('initiatorName').value = data.initiator_name || '';
        document.getElementById('initiatorPassword').value = data.initiator_password || '';
        document.getElementById('initiatorEncryption').value = data.initiator_encryption || '';
      }
    } catch (err) { console.error('Failed to load mpesa configs', err); }
  }

  if (mpesaForm) {
    mpesaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        shortcode: document.getElementById('shortcode').value,
        consumer_key: document.getElementById('consumerKey').value,
        consumer_secret: document.getElementById('consumerSecret').value,
        pass_key: document.getElementById('passKey').value,
        initiator_name: document.getElementById('initiatorName').value,
        initiator_password: document.getElementById('initiatorPassword').value,
        initiator_encryption: document.getElementById('initiatorEncryption').value
      };
      try {
        await fetchAPI('/mpesa-configs/1/', { method: 'PUT', body: JSON.stringify(payload) });
        alert('Mpesa Configurations saved successfully!');
      } catch (err) { alert('Error saving configurations: ' + err.message); }
    });
  }

  // Initial load calls
  loadAgencyProfile();
  loadMessengerConfig();
  loadMailerConfig();
  loadMpesaConfig();
});