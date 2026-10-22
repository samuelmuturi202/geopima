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

  // Elements
  const landlordSelect = document.getElementById('select-landlord');
  const propertySelect = document.getElementById('select-property');
  const unitSelect = document.getElementById('select-unit');
  const directTenantSelect = document.getElementById('select-tenant-direct');

  // Load Initial Data from Backend
  async function init() {
    try {
      if (landlordSelect) {
        const landlords = await fetchAPI('/properties/landlords/');
        const landlordList = landlords.results || landlords;
        landlordList.forEach(landlord => {
          const opt = document.createElement('option');
          opt.value = landlord.id;
          opt.textContent = landlord.name || `${landlord.first_name} ${landlord.last_name}`;
          landlordSelect.appendChild(opt);
        });
      }

      if (directTenantSelect) {
        const tenants = await fetchAPI('/tenants/active-list/');
        const tenantList = tenants.results || tenants;
        tenantList.forEach(tenant => {
          const opt = document.createElement('option');
          opt.value = tenant.id;
          opt.textContent = tenant.display_label || `${tenant.name} (${tenant.unit_name || 'Unit'})`;
          directTenantSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('Error populating initial dropdowns:', err);
    }
  }

  // Handle Landlord Selection -> Load Properties from API
  if (landlordSelect) {
    landlordSelect.addEventListener('change', async (e) => {
      const landlordId = e.target.value;

      propertySelect.innerHTML = '';
      unitSelect.innerHTML = '';
      unitSelect.disabled = true;
      unitSelect.innerHTML = '<option value="">--Select Property First--</option>';

      if (landlordId) {
        try {
          propertySelect.disabled = false;
          propertySelect.innerHTML = '<option value="">Loading properties...</option>';

          const properties = await fetchAPI(`/properties/properties/?landlord=${landlordId}`);
          const propertyList = properties.results || properties;

          propertySelect.innerHTML = '<option value="">--Select Property--</option>';
          propertyList.forEach(prop => {
            const opt = document.createElement('option');
            opt.value = prop.id;
            opt.textContent = prop.name;
            propertySelect.appendChild(opt);
          });
        } catch (err) {
          propertySelect.innerHTML = '<option value="">Error loading properties</option>';
        }
      } else {
        propertySelect.disabled = true;
        propertySelect.innerHTML = '<option value="">--Select Landlord First--</option>';
      }
    });
  }

  // Handle Property Selection -> Load Units from API
  if (propertySelect) {
    propertySelect.addEventListener('change', async (e) => {
      const propertyId = e.target.value;

      unitSelect.innerHTML = '';

      if (propertyId) {
        try {
          unitSelect.disabled = false;
          unitSelect.innerHTML = '<option value="">Loading units...</option>';

          const units = await fetchAPI(`/properties/units/?property=${propertyId}`);
          const unitList = units.results || units;

          unitSelect.innerHTML = '<option value="">--Select Unit/Tenant--</option>';
          unitList.forEach(unit => {
            const opt = document.createElement('option');
            opt.value = unit.id;
            opt.textContent = unit.display_label || `${unit.unit_number} - ${unit.tenant_name || 'Vacant'}`;
            unitSelect.appendChild(opt);
          });
        } catch (err) {
          unitSelect.innerHTML = '<option value="">Error loading units</option>';
        }
      } else {
        unitSelect.disabled = true;
        unitSelect.innerHTML = '<option value="">--Select Property First--</option>';
      }
    });
  }

  // Handle Cascade Form Submit
  const cascadeForm = document.getElementById('cascade-form');
  if (cascadeForm) {
    cascadeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const selectedUnit = unitSelect.value;
      if (!selectedUnit) {
        alert('Please select Landlord, Property, and Unit/Tenant before continuing.');
        return;
      }
      window.location.href = `collect-rent-payment.html?unit_id=${selectedUnit}`;
    });
  }

  // Handle Direct Form Submit
  const directTenantForm = document.getElementById('direct-tenant-form');
  if (directTenantForm) {
    directTenantForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const selectedTenant = directTenantSelect.value;
      if (!selectedTenant) {
        alert('Please select a tenant before continuing.');
        return;
      }
      window.location.href = `collect-rent-payment.html?tenant_id=${selectedTenant}`;
    });
  }

  init();
});