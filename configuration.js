// configuration.js
document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

  async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  }

  // Fetch and apply live agency settings to UI (Updated to match Singleton /agency-profile/1/ endpoint)
  async function loadAgencyProfile() {
    try {
      const config = await fetchAPI('/agency-profile/1/');
      if (config && config.company_name) {
        document.querySelectorAll('.agency-title-placeholder').forEach(el => {
          el.innerText = config.company_name;
        });
      }
    } catch (err) {
      console.warn('Could not retrieve backend agency profile:', err);
    }
  }

  // Configuration Card Click Handling
  const configCards = document.querySelectorAll('.config-card');

  configCards.forEach(card => {
    card.addEventListener('click', (e) => {
      const labelEl = card.querySelector('.card-label');
      const label = labelEl ? labelEl.innerText : 'Configuration Card';
      
      const href = card.getAttribute('href');
      if (href && href !== '#' && !href.endsWith('.html')) {
        e.preventDefault();
        window.location.href = href;
      } else {
        console.log(`Navigating to configuration section: ${label}`);
      }
    });
  });

  loadAgencyProfile();
});