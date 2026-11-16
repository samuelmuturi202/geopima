document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'https://geopima.onrender.com/api/v1';

  async function fetchAPI(endpoint, options = {}) {
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

  function exportProperties() {
    if (!currentProperties.length) {
      alert('There are no properties to export.');
      return;
    }
    const columns = ['Property ID', 'Name', 'Landlord', 'Location', 'Cluster', 'Units', 'Occupied Units', 'Status'];
    const rows = currentProperties.map(item => [
      item.property_id || item.propertyId || item.code || item.id || '',
      item.name || item.propertyName || '',
      typeof item.landlord === 'object' && item.landlord ? item.landlord.name || '' : item.landlord_name || item.landlord || '',
      item.location || '',
      item.cluster || '',
      item.total_units ?? item.units_count ?? '',
      item.occupied_units ?? '',
      item.status || (item.is_active ? 'active' : 'inactive')
    ]);
    window.downloadCsv('properties.csv', columns, rows);
  }

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', (event) => {
      event.preventDefault();
      exportProperties();
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', (event) => {
      event.preventDefault();
      window.print();
    });
  }

  // 2. Fetch and Render Properties Table
  const tableBody = document.querySelector('#properties-table tbody');
  const searchInput = document.getElementById('table-search');
  const tableInfo = document.getElementById('table-info');
  const pagination = document.getElementById('properties-pagination');
  const statusLinks = document.querySelectorAll('.status-link[data-status]');
  let currentProperties = [];
  let currentPage = 1;
  let currentStatusFilter = 'active';
  const rowsPerPage = 10;

  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    let propertiesList = [];
    if (Array.isArray(data)) {
      propertiesList = data;
    } else if (data && typeof data === 'object') {
      propertiesList = data.results || data.data || data.properties || Object.values(data).find(val => Array.isArray(val)) || [];
    }

    if (!Array.isArray(propertiesList)) {
      propertiesList = [];
    }
    currentProperties = propertiesList;
    const filteredProperties = propertiesList.filter(item => {
      const status = String(item.status || (item.is_active ? 'active' : 'inactive')).toLowerCase();
      return currentStatusFilter === 'active'
        ? status === 'active'
        : status === currentStatusFilter;
    });

    if (filteredProperties.length === 0) {
      currentPage = 1;
      tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:15px;">No ${currentStatusFilter} properties found</td></tr>`;
      if (tableInfo) tableInfo.textContent = 'Showing 0 to 0 of 0 entries';
      renderPagination(0);
      return;
    }

    const pageCount = Math.ceil(filteredProperties.length / rowsPerPage);
    currentPage = Math.min(currentPage, pageCount);
    const start = (currentPage - 1) * rowsPerPage;
    const pageProperties = filteredProperties.slice(start, start + rowsPerPage);
    pageProperties.forEach((item, index) => {
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
      const stringLookupId = item.property_id || item.propertyId || item.code || item.id;

      row.innerHTML = `
        <td>${start + index + 1}</td>
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
    if (tableInfo) {
      tableInfo.textContent = `Showing ${start + 1} to ${Math.min(start + rowsPerPage, filteredProperties.length)} of ${filteredProperties.length} entries`;
    }
    renderPagination(pageCount);
  }

  function renderPagination(pageCount) {
    if (!pagination) return;
    const previousState = document.createElement('li');
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'page-btn';
    prev.textContent = 'Previous';
    prev.disabled = currentPage <= 1 || pageCount === 0;
    prev.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage -= 1;
        renderTable(currentProperties);
      }
    });
    previousState.appendChild(prev);
    pagination.replaceChildren(previousState);

    for (let page = 1; page <= pageCount; page += 1) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `page-btn ${page === currentPage ? 'active' : ''}`;
      button.textContent = String(page);
      button.addEventListener('click', () => {
        currentPage = page;
        renderTable(currentProperties);
      });
      item.appendChild(button);
      pagination.appendChild(item);
    }

    const nextState = document.createElement('li');
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'page-btn';
    next.textContent = 'Next';
    next.disabled = currentPage >= pageCount;
    next.addEventListener('click', () => {
      if (currentPage < pageCount) {
        currentPage += 1;
        renderTable(currentProperties);
      }
    });
    nextState.appendChild(next);
    pagination.appendChild(nextState);
  }

  async function loadProperties(searchQuery = '') {
    try {
      const queryParam = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
      const response = await fetchAPI(`/properties/${queryParam}`);
      currentPage = 1;
      renderTable(response);
    } catch (err) {
      console.error('Failed to load properties:', err);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:red; padding:15px;">Error loading properties: ${err.message}</td></tr>`;
      }
    }
  }

  const agreementsBtn = document.getElementById('properties-agreements-btn');
  if (agreementsBtn) {
    agreementsBtn.addEventListener('click', () => {
      window.location.href = 'tenants.html?show=agreements';
    });
  }

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();
      debounceTimer = setTimeout(() => loadProperties(query), 300);
    });
  }

  statusLinks.forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      currentStatusFilter = link.dataset.status;
      currentPage = 1;
      statusLinks.forEach(statusLink => statusLink.classList.toggle('active', statusLink === link));
      renderTable(currentProperties);
    });
  });

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

    let availableItems = config.initialItems.map(name => ({
      id: null,
      name,
      is_active: config.defaultSelected.includes(name)
    }));
    let selectedItems = new Set(config.defaultSelected);

    function renderChips() {
      if (!grid) return;
      grid.innerHTML = '';
      availableItems.forEach(item => {
        const chip = document.createElement('div');
        chip.className = `chip-option ${selectedItems.has(item.name) ? 'selected' : ''}`;
        chip.textContent = item.name;
        chip.addEventListener('click', () => {
          if (selectedItems.has(item.name)) {
            selectedItems.delete(item.name);
          } else {
            selectedItems.add(item.name);
          }
          renderChips();
        });
        grid.appendChild(chip);
      });
    }

    const closeModal = () => modal.classList.remove('active');

    openBtn.addEventListener('click', async () => {
      try {
        const response = await fetchAPI(`/properties/unit-options/?kind=${config.kind}`);
        const savedOptions = response.results || response;
        if (!Array.isArray(savedOptions)) throw new Error('Unexpected unit option response.');
        availableItems = config.initialItems.map(name => {
          const savedOption = savedOptions.find(option => option.name.toLowerCase() === name.toLowerCase());
          return savedOption || {
            id: null,
            name,
            is_active: config.defaultSelected.includes(name)
          };
        });
        savedOptions.forEach(option => {
          if (!availableItems.some(item => item.name.toLowerCase() === option.name.toLowerCase())) {
            availableItems.push(option);
          }
        });
        selectedItems = new Set(availableItems.filter(item => item.is_active).map(item => item.name));
        renderChips();
        modal.classList.add('active');
      } catch (error) {
        alert(`Failed to load unit options: ${error.message}`);
      }
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (addBtn && input) {
      addBtn.addEventListener('click', async () => {
        const val = input.value.trim();
        if (!val || availableItems.some(item => item.name.toLowerCase() === val.toLowerCase())) return;
        availableItems.push({ id: null, name: val, is_active: true });
        selectedItems.add(val);
        input.value = '';
        renderChips();
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener('click', async () => {
        try {
          const savedOptions = await fetchAPI('/properties/unit-options/sync/', {
            method: 'POST',
            body: {
              kind: config.kind,
              options: availableItems.map(item => ({
                id: item.id,
                name: item.name,
                is_active: selectedItems.has(item.name)
              }))
            }
          });
          availableItems = savedOptions;
          selectedItems = new Set(savedOptions.filter(item => item.is_active).map(item => item.name));
          closeModal();
        } catch (error) {
          alert(`Failed to save unit options: ${error.message}`);
        }
      });
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  setupTagModal({
    openBtnId: 'open-unit-type-btn',
    modalId: 'unitTypeModal',
    closeBtnId: 'closeTypeModalBtn',
    cancelBtnId: 'cancelTypeModalBtn',
    applyBtnId: 'applyTypeModalBtn',
    gridId: 'unitTypeGrid',
    inputId: 'newTypeName',
    addBtnId: 'addTypeBtn',
    initialItems: ['Residential', 'Commercial', 'Industrial', 'Mixed Use', 'Bedsitter', 'Single Room'],
    defaultSelected: ['Residential'],
    kind: 'type'
  });

  setupTagModal({
    openBtnId: 'open-unit-cat-btn',
    modalId: 'unitCatModal',
    closeBtnId: 'closeCatModalBtn',
    cancelBtnId: 'cancelCatModalBtn',
    applyBtnId: 'applyCatModalBtn',
    gridId: 'unitCatGrid',
    inputId: 'newCatName',
    addBtnId: 'addCatBtn',
    initialItems: ['Standard', 'Executive', 'Deluxe', 'Economy', 'Residential'],
    defaultSelected: ['Standard'],
    kind: 'category'
  });

  loadProperties();
});