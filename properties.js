document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

  async function fetchAPI(endpoint, options = {}) {
    // Check multiple fallback keys for stored JWT tokens
    const token = localStorage.getItem('access_token') || localStorage.getItem('token') || localStorage.getItem('access');
    
    const headers = {
      ...(!(options.body instanceof FormData) && { 'Content-Type': 'application/json' }),
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };
    
    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
      body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers, body });
    
    if (response.status === 204) return null;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      let message = errorData.detail;
      if (!message && typeof errorData === 'object') {
        message = Object.entries(errorData)
          .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(', ') : errs}`)
          .join('\n');
      }
      throw new Error(message || response.statusText);
    }
    
    return response.json();
  }

  // 1. Export Dropdown Interactivity
  const exportBtn = document.getElementById('export-btn');
  const exportContainer = exportBtn ? exportBtn.closest('.dropdown-container') : null;

  if (exportBtn && exportContainer) {
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportContainer.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      exportContainer.classList.remove('open');
    });
  }

  const exportExcelBtn = document.getElementById('export-excel-btn');
  const exportPdfBtn = document.getElementById('export-pdf-btn');

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', () => {
      window.open(`${API_BASE_URL}/properties/export/?format=excel`, '_blank');
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      window.open(`${API_BASE_URL}/properties/export/?format=pdf`, '_blank');
    });
  }

  // 2. Fetch and Render Properties Table
  const tableBody = document.querySelector('#properties-table tbody');
  const searchInput = document.getElementById('table-search');

  function renderTable(data) {
    console.log("RAW API DATA RECEIVED:", data);

    if (!tableBody) {
      console.error("CRITICAL ERROR: document.querySelector('#properties-table tbody') returned null! Check your HTML table ID.");
      return;
    }
    tableBody.innerHTML = '';

    // Bulletproof array extraction supporting various DRF response structures
    let propertiesList = [];
    if (Array.isArray(data)) {
      propertiesList = data;
    } else if (data && typeof data === 'object') {
      propertiesList = data.results || data.data || data.properties || Object.values(data).find(val => Array.isArray(val)) || [];
    }

    if (!Array.isArray(propertiesList)) {
      propertiesList = [];
    }

    console.log("PARSED PROPERTIES LIST ARRAY:", propertiesList);

    if (propertiesList.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:15px;">No properties found</td></tr>`;
      return;
    }

    propertiesList.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;

      const row = document.createElement('tr');
      
      const propId = item.property_id || item.propertyId || item.code || `PRO-${item.id}` || '-';
      const propName = item.name || item.propertyName || '-';
      
      const landlordName = typeof item.landlord === 'object' && item.landlord !== null
        ? (item.landlord?.name || '-') 
        : (item.landlord_name || item.landlordName || item.landlord || '-');
        
      const description = item.description || '-';
      const location = item.location || '-';
      const cluster = item.cluster || '-';
      
      const totalUnits = item.total_units !== undefined ? item.total_units : (item.units_count || 0);
      const occupiedUnits = item.occupied_units !== undefined ? item.occupied_units : 0;
      const occUnitsStr = `${occupiedUnits}/${totalUnits}`;

      const commRate = item.commission_percentage !== undefined && item.commission_percentage !== null 
        ? `${item.commission_percentage}%` 
        : (item.commissionRate ? `${item.commissionRate}%` : '-');

      const statusText = item.status || (item.is_active ? 'active' : 'inactive');
      const badgeClass = statusText.toLowerCase() === 'active' ? 'bg-success' : 'bg-secondary';

      // Strictly utilize the string property_id for lookups matching Django's lookup_field
      const stringLookupId = item.property_id || item.propertyId || item.code || item.id;

      row.innerHTML = `
        <td>${index + 1}</td>
        <td><strong><a href="property_detail.html?id=${stringLookupId}" class="link-dashed">${propId}</a></strong></td>
        <td>${propName}</td>
        <td>${landlordName}</td>
        <td>${description}</td>
        <td>${location}</td>
        <td><span class="badge ${badgeClass}">${cluster}</span></td>
        <td><strong class="occ-count">${occUnitsStr}</strong></td>
        <td>${commRate}</td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
      `;
      tableBody.appendChild(row);
    });
  }

  async function loadProperties(searchQuery = '') {
    try {
      const queryParam = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
      // Updated endpoint path to prevent path duplication
      const response = await fetchAPI(`/properties/${queryParam}`);
      renderTable(response);
    } catch (err) {
      console.error('Failed to load properties:', err);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:red; padding:15px;">Error loading properties from server: ${err.message}</td></tr>`;
      }
    }
  }

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();
      debounceTimer = setTimeout(() => loadProperties(query), 300);
    });
  }

  // 3. Add Property Modal & Form Handling
  const addPropertyBtn = document.getElementById('add-property-btn');
  const propertyModal = document.getElementById('property-modal');
  const closeModalBtns = document.querySelectorAll('.close-modal');
  const propertyForm = document.getElementById('property-form');

  if (addPropertyBtn && propertyModal) {
    addPropertyBtn.addEventListener('click', () => {
      propertyModal.classList.add('active');
    });
  }

  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (propertyModal) propertyModal.classList.remove('active');
    });
  });

  if (propertyForm) {
    propertyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const rawLandlordVal = document.getElementById('landlord-id')?.value || document.getElementById('landlord-name')?.value || '';
      
      // Correctly handle either numeric ID strings or raw text names
      let landlordValue = null;
      if (rawLandlordVal.trim() !== '') {
        const parsedId = parseInt(rawLandlordVal, 10);
        landlordValue = isNaN(parsedId) ? rawLandlordVal.trim() : parsedId;
      }

      const payload = {
        property_id: document.getElementById('property-id')?.value || '',
        name: document.getElementById('property-name')?.value || '',
        landlord: landlordValue,
        cluster: document.getElementById('property-cluster')?.value || '',
        location: document.getElementById('property-location')?.value || '',
        description: document.getElementById('property-description')?.value || '',
        total_units: parseInt(document.getElementById('units-count')?.value || '0', 10),
        commission_percentage: parseFloat(document.getElementById('commission-rate')?.value || '0'),
        status: document.getElementById('property-status')?.value || 'active'
      };

      try {
        // Updated POST endpoint to target the correct base resource path
        await fetchAPI('/properties/', {
          method: 'POST',
          body: payload
        });
        
        propertyForm.reset();
        if (propertyModal) propertyModal.classList.remove('active');
        await loadProperties();
      } catch (err) {
        alert('Failed to save property:\n' + err.message);
      }
    });
  }

  // 4. Custom Unit Type & Unit Category Creation Popups
  function setupTagModal(config) {
    const openBtn = document.getElementById(config.openBtnId);
    const modal = document.getElementById(config.modalId);
    const closeBtn = document.getElementById(config.closeBtnId);
    const cancelBtn = document.getElementById(config.cancelBtnId);
    const applyBtn = document.getElementById(config.applyBtnId);
    const grid = document.getElementById(config.gridId);
    const input = document.getElementById(config.inputId);
    const addBtn = document.getElementById(config.addBtnId);

    if (!openBtn || !modal) return;

    let availableItems = config.initialItems;
    let selectedItems = new Set(config.defaultSelected);

    function renderChips() {
      if (!grid) return;
      grid.innerHTML = '';
      availableItems.forEach(item => {
        const chip = document.createElement('div');
        chip.className = `chip-option ${selectedItems.has(item) ? 'selected' : ''}`;
        chip.textContent = item;
        chip.addEventListener('click', () => {
          if (selectedItems.has(item)) {
            selectedItems.delete(item);
          } else {
            selectedItems.add(item);
          }
          renderChips();
        });
        grid.appendChild(chip);
      });
    }

    const closeModal = () => modal.classList.remove('active');

    openBtn.addEventListener('click', () => {
      renderChips();
      modal.classList.add('active');
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (addBtn && input) {
      addBtn.addEventListener('click', async () => {
        const val = input.value.trim();
        if (val && !availableItems.includes(val)) {
          availableItems.push(val);
          selectedItems.add(val);
          input.value = '';
          renderChips();

          if (config.apiEndpoint) {
            try {
              await fetchAPI(config.apiEndpoint, {
                method: 'POST',
                body: { name: val }
              });
            } catch (err) {
              console.warn('Backend tag sync note:', err.message);
            }
          }
        }
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        closeModal();
      });
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Unit Type Setup
  setupTagModal({
    openBtnId: 'open-unit-type-btn',
    modalId: 'unitTypeModal',
    closeBtnId: 'closeTypeModalBtn',
    cancelBtnId: 'cancelTypeModalBtn',
    applyBtnId: 'applyTypeModalBtn',
    gridId: 'unitTypeGrid',
    inputId: 'newTypeName',
    addBtnId: 'addTypeBtn',
    initialItems: ['Residential', 'Commercial', 'Industrial', 'Mixed Use', 'Bedsitter'],
    defaultSelected: ['Residential'],
    apiEndpoint: '/properties/unit-types/'
  });

  // Unit Category Setup
  setupTagModal({
    openBtnId: 'open-unit-cat-btn',
    modalId: 'unitCatModal',
    closeBtnId: 'closeCatModalBtn',
    cancelBtnId: 'closeCatModalBtn',
    applyBtnId: 'applyCatModalBtn',
    gridId: 'unitCatGrid',
    inputId: 'newCatName',
    addBtnId: 'addCatBtn',
    initialItems: ['Standard', 'Executive', 'Deluxe', 'Economy'],
    defaultSelected: ['Standard'],
    apiEndpoint: '/properties/unit-categories/'
  });

  loadProperties();
});