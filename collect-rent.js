document.addEventListener('DOMContentLoaded', () => {

  // Mock Data Store
  const mockData = {
    landlords: [
      { id: '1', name: 'John Kamau' },
      { id: '2', name: 'Mary Wanjiku' }
    ],
    properties: {
      '1': [
        { id: 'p1', name: 'Agnes Njambi Plot' },
        { id: 'p2', name: 'Daniel Plot' }
      ],
      '2': [
        { id: 'p3', name: 'Grace Gaitho House' }
      ]
    },
    units: {
      'p1': [
        { id: 'u101', name: 'Unit A1 - Peter Njoroge' },
        { id: 'u102', name: 'Unit A2 - Sarah Wairimu' }
      ],
      'p2': [
        { id: 'u201', name: 'Unit B1 - David Chege' }
      ],
      'p3': [
        { id: 'u301', name: 'Unit C1 - Lucy Wambui' }
      ]
    },
    allTenants: [
      { id: 't1', name: 'Peter Njoroge (Unit A1 - Agnes Njambi Plot)' },
      { id: 't2', name: 'Sarah Wairimu (Unit A2 - Agnes Njambi Plot)' },
      { id: 't3', name: 'David Chege (Unit B1 - Daniel Plot)' },
      { id: 't4', name: 'Lucy Wambui (Unit C1 - Grace Gaitho House)' }
    ]
  };

  // Elements
  const landlordSelect = document.getElementById('select-landlord');
  const propertySelect = document.getElementById('select-property');
  const unitSelect = document.getElementById('select-unit');
  const directTenantSelect = document.getElementById('select-tenant-direct');

  // Populate Initial Dropdowns
  function init() {
    if (landlordSelect) {
      mockData.landlords.forEach(landlord => {
        const opt = document.createElement('option');
        opt.value = landlord.id;
        opt.textContent = landlord.name;
        landlordSelect.appendChild(opt);
      });
    }

    if (directTenantSelect) {
      mockData.allTenants.forEach(tenant => {
        const opt = document.createElement('option');
        opt.value = tenant.id;
        opt.textContent = tenant.name;
        directTenantSelect.appendChild(opt);
      });
    }
  }

  // Handle Landlord Selection -> Load Properties
  if (landlordSelect) {
    landlordSelect.addEventListener('change', (e) => {
      const landlordId = e.target.value;

      propertySelect.innerHTML = '';
      unitSelect.innerHTML = '';
      unitSelect.disabled = true;
      unitSelect.innerHTML = '<option value="">--Select Property First--</option>';

      if (landlordId && mockData.properties[landlordId]) {
        propertySelect.disabled = false;
        propertySelect.innerHTML = '<option value="">--Select Property--</option>';

        mockData.properties[landlordId].forEach(prop => {
          const opt = document.createElement('option');
          opt.value = prop.id;
          opt.textContent = prop.name;
          propertySelect.appendChild(opt);
        });
      } else {
        propertySelect.disabled = true;
        propertySelect.innerHTML = '<option value="">--Select Landlord First--</option>';
      }
    });
  }

  // Handle Property Selection -> Load Units/Tenants
  if (propertySelect) {
    propertySelect.addEventListener('change', (e) => {
      const propertyId = e.target.value;

      unitSelect.innerHTML = '';

      if (propertyId && mockData.units[propertyId]) {
        unitSelect.disabled = false;
        unitSelect.innerHTML = '<option value="">--Select Unit/Tenant--</option>';

        mockData.units[propertyId].forEach(unit => {
          const opt = document.createElement('option');
          opt.value = unit.id;
          opt.textContent = unit.name;
          unitSelect.appendChild(opt);
        });
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
      alert(`Proceeding to collect rent for Unit ID: ${selectedUnit}`);
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
      alert(`Proceeding to collect rent for Tenant ID: ${selectedTenant}`);
    });
  }

  init();
});