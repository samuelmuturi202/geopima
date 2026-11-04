// collect-rent.js

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'https://geopima.onrender.com/api/v1';

  function getStoredAccessToken() {
    return localStorage.getItem('access_token') || 
           localStorage.getItem('accessToken') || 
           localStorage.getItem('token');
  }

  async function fetchAPI(endpoint, options = {}) {
    const token = getStoredAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };

    console.log(`[API Request] Fetching: ${API_BASE_URL}${endpoint}`);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    
    if (response.status === 401 || response.status === 403) {
      console.warn('Session expired or unauthorized. Redirecting to login.');
      localStorage.clear();
      window.location.href = 'login.html';
      throw new Error('Unauthorized: Session expired.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error [${response.status}] on ${endpoint}:`, errorText);
      throw new Error(`API Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // DOM Elements
  const landlordSelect = document.getElementById('select-landlord');
  const propertySelect = document.getElementById('select-property');
  const unitSelect = document.getElementById('select-unit');
  const directTenantSelect = document.getElementById('select-tenant-direct');

  /**
   * Load Initial Dropdown Data from Backend
   */
  async function init() {
    try {
      // 1. Populate Landlords Dropdown
      if (landlordSelect) {
        landlordSelect.innerHTML = '<option value="">Loading landlords...</option>';
        const landlordsData = await fetchAPI('/properties/landlords/');
        
        // Handle DRF pagination or raw list arrays
        const landlordList = Array.isArray(landlordsData) ? landlordsData : (landlordsData.results || []);
        
        landlordSelect.innerHTML = '<option value="">--Select Landlord--</option>';
        
        if (landlordList.length === 0) {
          landlordSelect.innerHTML = '<option value="">No landlords found in database</option>';
          console.warn('Landlords list returned empty. Please check if landlords are added in your backend.');
        } else {
          landlordList.forEach(landlord => {
            const opt = document.createElement('option');
            opt.value = landlord.id;
            opt.textContent = landlord.name || landlord.display_name || `${landlord.first_name || ''} ${landlord.last_name || ''}`.trim() || `Landlord #${landlord.id}`;
            landlordSelect.appendChild(opt);
          });
        }
      }

      // 2. Populate Direct Tenants Dropdown
      if (directTenantSelect) {
        try {
          const tenantsData = await fetchAPI('/tenants/active-list/');
          const tenantList = Array.isArray(tenantsData) ? tenantsData : (tenantsData.results || []);
          
          directTenantSelect.innerHTML = '<option value="">--Select Tenant--</option>';
          tenantList.forEach(tenant => {
            const opt = document.createElement('option');
            opt.value = tenant.id;
            opt.textContent = tenant.display_label || `${tenant.name} (${tenant.unit_name || 'Unit'})`;
            directTenantSelect.appendChild(opt);
          });
        } catch (tenantErr) {
          console.warn('Could not load direct tenants list:', tenantErr);
        }
      }
    } catch (err) {
      console.error('Error initializing collection dropdowns:', err);
      if (landlordSelect) {
        landlordSelect.innerHTML = '<option value="">Error loading landlords</option>';
      }
    }
  }

  /**
   * Handle Landlord Selection -> Load Properties
   */
  if (landlordSelect) {
    landlordSelect.addEventListener('change', async (e) => {
      const landlordId = e.target.value;

      propertySelect.innerHTML = '<option value="">--Select Landlord First--</option>';
      propertySelect.disabled = true;
      unitSelect.innerHTML = '<option value="">--Select Property First--</option>';
      unitSelect.disabled = true;

      if (landlordId) {
        try {
          propertySelect.disabled = false;
          propertySelect.innerHTML = '<option value="">Loading properties...</option>';

          const propertiesData = await fetchAPI(`/properties/?landlord=${landlordId}`);
          const propertyList = Array.isArray(propertiesData) ? propertiesData : (propertiesData.results || []);

          propertySelect.innerHTML = '<option value="">--Select Property--</option>';
          
          if (propertyList.length === 0) {
            propertySelect.innerHTML = '<option value="">No properties found for this landlord</option>';
            return;
          }

          propertyList.forEach(prop => {
            const opt = document.createElement('option');
            opt.value = prop.id;
            opt.textContent = prop.name;
            propertySelect.appendChild(opt);
          });
        } catch (err) {
          console.error('Failed to load properties:', err);
          propertySelect.innerHTML = '<option value="">Error loading properties</option>';
        }
      }
    });
  }

  /**
   * Handle Property Selection -> Load Units
   */
  if (propertySelect) {
    propertySelect.addEventListener('change', async (e) => {
      const propertyId = e.target.value;

      unitSelect.innerHTML = '<option value="">--Select Property First--</option>';
      unitSelect.disabled = true;

      if (propertyId) {
        try {
          unitSelect.disabled = false;
          unitSelect.innerHTML = '<option value="">Loading units...</option>';

          const unitsData = await fetchAPI(`/properties/units/?property=${propertyId}`);
          const unitList = Array.isArray(unitsData) ? unitsData : (unitsData.results || []);

          unitSelect.innerHTML = '<option value="">--Select Unit/Tenant--</option>';
          
          if (unitList.length === `0`) {
            unitSelect.innerHTML = '<option value="">No units found in this property</option>';
            return;
          }

          unitList.forEach(unit => {
            const opt = document.createElement('option');
            opt.value = unit.id;
            opt.textContent = unit.display_label || `${unit.unit_number || unit.unit_no} - ${unit.tenant_name || 'Vacant'}`;
            unitSelect.appendChild(opt);
          });
        } catch (err) {
          console.error('Failed to load units:', err);
          unitSelect.innerHTML = '<option value="">Error loading units</option>';
        }
      }
    });
  }

  // Initialize data on page load
  init();
});