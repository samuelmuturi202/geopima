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
    
    if (response.status === 401) {
      console.warn('Session expired or unauthenticated. Redirecting to login.');
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

  async function fetchAllPages(endpoint) {
    const results = [];
    const apiUrl = new URL(API_BASE_URL);
    let nextEndpoint = endpoint;

    while (nextEndpoint) {
      const response = await fetchAPI(nextEndpoint);
      if (Array.isArray(response)) return results.concat(response);
      results.push(...(response.results || []));
      if (!response.next) break;

      const nextUrl = new URL(response.next, apiUrl);
      if (nextUrl.origin !== apiUrl.origin || !nextUrl.pathname.startsWith(`${apiUrl.pathname}/`)) {
        throw new Error('The tenants API returned an invalid pagination URL.');
      }
      nextEndpoint = `${nextUrl.pathname.slice(apiUrl.pathname.length)}${nextUrl.search}`;
    }

    return results;
  }

  // DOM Elements
  const landlordSelect = document.getElementById('select-landlord');
  const propertySelect = document.getElementById('select-property');
  const unitSelect = document.getElementById('select-unit');
  const directTenantSelect = document.getElementById('select-tenant-direct');
  const cascadeForm = document.getElementById('cascade-form');
  const directTenantForm = document.getElementById('direct-tenant-form');
  let activeTenants = [];
  let selectedUnits = [];

  function getTenantUnitId(tenant) {
    const rawUnit = tenant.unit;
    return typeof rawUnit === 'object' && rawUnit !== null ? rawUnit.id : rawUnit;
  }

  async function openTenantInvoice(tenantId) {
    if (!tenantId) {
      alert('Select a tenant before continuing.');
      return;
    }
    try {
      const tenant = activeTenants.find(item => String(item.id || item.tenant_id) === String(tenantId));
      const search = tenant?.tenant_id || tenantId;
      const response = await fetchAPI(`/billing/invoices/?search=${encodeURIComponent(search)}`);
      const invoices = response.results || response;
      const openInvoices = invoices.filter(invoice =>
        String(invoice.tnt || invoice.tenant_id || '') === String(search)
        && Number(invoice.balance || 0) > 0
      );
      if (!openInvoices.length) {
        alert('This tenant has no outstanding invoices. Generate an invoice before collecting rent.');
        return;
      }

      let invoice = openInvoices[0];
      if (openInvoices.length > 1) {
        const choices = openInvoices.map((item, index) =>
          `${index + 1}. ${item.invoice_no || item.invoice_number} — ${item.period} — KES ${Number(item.balance).toLocaleString()}`
        );
        const selected = prompt(`Choose an invoice number to collect:\n${choices.join('\n')}`, '1');
        if (selected === null) return;
        const choice = Number(selected);
        if (!Number.isInteger(choice) || choice < 1 || choice > openInvoices.length) {
          alert('Enter a valid invoice number from the list.');
          return;
        }
        invoice = openInvoices[choice - 1];
      }
      window.location.href = `invoice.html?id=${encodeURIComponent(invoice.id)}&action=payment`;
    } catch (error) {
      alert(`Could not load this tenant's outstanding invoices: ${error.message}`);
    }
  }

  if (cascadeForm) {
    cascadeForm.addEventListener('submit', event => {
      event.preventDefault();
      const selectedUnit = selectedUnits.find(unit => String(unit.id) === String(unitSelect.value));
      const tenantId = typeof selectedUnit?.tenant === 'object'
        ? selectedUnit.tenant.id
        : selectedUnit?.tenant;
      if (!tenantId) {
        alert('The selected unit has no active tenant. Choose an occupied unit or select the tenant directly.');
        return;
      }
      const tenant = activeTenants.find(item =>
        String(item.id || item.tenant_id) === String(tenantId)
      );
      openTenantInvoice(tenant?.id || tenantId);
    });
  }

  if (directTenantForm) {
    directTenantForm.addEventListener('submit', event => {
      event.preventDefault();
      openTenantInvoice(directTenantSelect.value);
    });
  }

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
          const tenantList = await fetchAllPages('/tenants/tenants/?status=active&page_size=100');
          activeTenants = tenantList;
          
          directTenantSelect.innerHTML = '<option value="">--Select Tenant--</option>';
          tenantList.forEach(tenant => {
            const opt = document.createElement('option');
            opt.value = tenant.id;
            opt.textContent = `${tenant.name} (${tenant.unit_name || 'Unit'})`;
            directTenantSelect.appendChild(opt);
          });
        } catch (tenantErr) {
          directTenantSelect.innerHTML = '<option value="">Error loading tenants</option>';
          throw tenantErr;
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
          selectedUnits = unitList;

          unitSelect.innerHTML = '<option value="">--Select Unit/Tenant--</option>';
          
          if (unitList.length === 0) {
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