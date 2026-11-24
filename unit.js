document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'https://geopima.onrender.com/api/v1';

  function getAuthToken() {
    return (
      localStorage.getItem('access_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('access')
    );
  }

  async function fetchAPI(endpoint, options = {}) {
    const token = getAuthToken();
    const headers = {
      ...(!(options.body instanceof FormData) && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
      body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers, body });
    if (response.status === 204) return null;
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API Error: ${response.statusText}`);
    }
    return response.json();
  }

  function normalizeAliasPart(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  function buildSmartAlias(row, fallbackUnitNo = '') {
    const rawAlias = row.smart_alias || row.alias || row.unitNo || row.unit_number || row.unit_no || fallbackUnitNo || '';
    const propCode = normalizeAliasPart(
      row.property_id || row.propertyId || row.property_code || (typeof row.property === 'object' && row.property ? row.property.property_id : '')
    );
    const houseName = normalizeAliasPart(
      row.unitName || row.unit_name || row.house_name || row.name || ''
    );

    if (propCode && houseName) {
      if (normalizeAliasPart(rawAlias).startsWith(`${propCode}-`)) {
        return normalizeAliasPart(rawAlias);
      }
      return `${propCode}-${houseName}`;
    }

    return rawAlias || '-';
  }

  const tableBody = document.getElementById('table-body');
  const searchInput = document.getElementById('table-search');
  const entriesSelect = document.getElementById('entries-per-page');
  const tableInfo = document.getElementById('table-info');
  const previousBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  const pageNumbers = document.getElementById('page-numbers');
  const exportBtn = document.getElementById('export-btn');
  const exportMenu = document.getElementById('export-menu');

  const propertyFilter = document.getElementById('filter-property');
  const landlordFilter = document.getElementById('filter-landlord');
  const vacancyFilter = document.getElementById('filter-vacancy');
  const statusFilter = document.getElementById('filter-status');

  let currentPage = 1;
  let rowsPerPage = parseInt(entriesSelect ? entriesSelect.value : 50, 10) || 50;

  async function loadPropertiesFilter() {
    if (!propertyFilter) return;
    try {
      const response = await fetchAPI('/properties/');
      const properties = Array.isArray(response) ? response : (response.results || []);
      propertyFilter.innerHTML = '<option value="All">Property: All</option>';
      properties.forEach(prop => {
        const propName = prop.name || prop.property_name;
        if (propName) {
          const option = document.createElement('option');
          option.value = propName;
          option.textContent = propName;
          propertyFilter.appendChild(option);
        }
      });
    } catch (err) {
      console.error('Failed to load properties list for filter:', err);
    }
  }

  async function loadLandlordsFilter() {
    if (!landlordFilter) return;
    try {
      const response = await fetchAPI('/properties/landlords/');
      const landlords = Array.isArray(response) ? response : (response.results || []);
      landlordFilter.innerHTML = '<option value="All">Landlord: All</option>';
      landlords.forEach(landlord => {
        const name =
          landlord.name ||
          landlord.full_name ||
          `${landlord.first_name || ''} ${landlord.last_name || ''}`.trim();
        if (name) {
          const option = document.createElement('option');
          option.value = name;
          option.textContent = name;
          landlordFilter.appendChild(option);
        }
      });
    } catch (err) {
      console.error('Failed to load landlords list for filter:', err);
    }
  }

  async function loadUnits() {
    if (!tableBody) return;

    try {
      const query = searchInput ? searchInput.value.trim() : '';
      const selectedProp = propertyFilter ? propertyFilter.value : 'All';
      const selectedLandlord = landlordFilter ? landlordFilter.value : 'All';
      const selectedVacancy = vacancyFilter ? vacancyFilter.value : 'All';
      const selectedStatus = statusFilter ? statusFilter.value : 'All';

      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('page_size', rowsPerPage);

      if (query) params.append('search', query);
      if (selectedProp !== 'All') params.append('property', selectedProp);
      if (selectedLandlord !== 'All') params.append('landlord', selectedLandlord);
      if (selectedVacancy !== 'All') params.append('vacancy', selectedVacancy);
      if (selectedStatus !== 'All') params.append('status', selectedStatus);

      const response = await fetchAPI(`/properties/units/?${params.toString()}`);
      const units = Array.isArray(response) ? response : (response.results || []);
      const totalCount = response.count ?? units.length;

      renderTable(units, totalCount);
    } catch (err) {
      console.error('Failed to load units:', err);
      tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:red; padding:20px;">Error fetching units from backend.</td></tr>`;
    }
  }

  function renderTable(items, totalEntries) {
    tableBody.innerHTML = '';

    if (!items || items.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 20px;">No units found matching criteria.</td></tr>`;
      if (tableInfo) tableInfo.textContent = 'Showing 0 to 0 of 0 entries';
      renderPagination(0);
      return;
    }

    const start = (currentPage - 1) * rowsPerPage;

    items.forEach((row, index) => {
      const tr = document.createElement('tr');
      const unitId = row.id;
      const smartAlias = buildSmartAlias(row, `U-${start + index + 1}`);
      const unitName = row.unitName || row.unit_name || row.house_name || row.name || '-';
      const propertyName =
        typeof row.property === 'object' && row.property !== null
          ? (row.property.name || row.property.property_name || '-')
          : (row.property_name || row.property || '-');
      const landlordName =
        typeof row.landlord === 'object' && row.landlord !== null
          ? (row.landlord.name || row.landlord.full_name || '-')
          : (row.landlord_name || row.landlord || '-');
      const tenantName =
        typeof row.tenant === 'object' && row.tenant !== null
          ? (row.tenant.name || row.tenant.full_name || 'Vacant')
          : (row.tenant_name || row.tenant || 'Vacant');
      const propLinkId =
        row.property_id ||
        (typeof row.property === 'object' && row.property ? (row.property.property_id || row.property.id) : null);
      const landlordLinkId =
        row.landlord_id ||
        (typeof row.landlord === 'object' && row.landlord ? row.landlord.id : null);
      const tenantLinkId =
        typeof row.tenant === 'object' && row.tenant ? row.tenant.id : row.tenant;

      tr.innerHTML = `
        <td>${start + index + 1}</td>
        <td><a href="unit_detail.html?id=${encodeURIComponent(unitId)}" class="link-code" title="Smart Alias: ${smartAlias}">${smartAlias}</a></td>
        <td><strong>${unitName}</strong></td>
        <td>${propLinkId ? `<a href="property_detail.html?id=${encodeURIComponent(propLinkId)}" class="link-text">${propertyName}</a>` : propertyName}</td>
        <td>${landlordLinkId ? `<a href="landlord-details.html?id=${encodeURIComponent(landlordLinkId)}" class="link-text">${landlordName}</a>` : landlordName}</td>
        <td>${row.unitType || row.unit_type || 'Single Room'}</td>
        <td>${row.unitCategory || row.category || 'Residential'}</td>
        <td>${tenantLinkId && tenantName !== 'Vacant' ? `<a href="tenant-detail.html?id=${encodeURIComponent(tenantLinkId)}" class="link-text">${tenantName}</a>` : tenantName}</td>
        <td class="text-center"><span class="badge-outline-occupied">${row.vacancy || (row.is_occupied ? 'occupied' : 'vacant')}</span></td>
        <td class="text-center"><span class="badge-solid-active">${(row.status || 'Active').toLowerCase()}</span></td>
      `;
      tableBody.appendChild(tr);
    });

    const actualEnd = Math.min(start + items.length, totalEntries);
    if (tableInfo) {
      tableInfo.textContent = `Showing ${start + 1} to ${actualEnd} of ${totalEntries} entries`;
    }
    renderPagination(totalEntries);
  }

  function renderPagination(totalEntries) {
    const totalPages = Math.ceil(totalEntries / rowsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      currentPage = totalPages;
    }

    if (previousBtn) {
      previousBtn.disabled = currentPage <= 1 || totalPages === 0;
      previousBtn.classList.toggle('disabled', previousBtn.disabled);
    }
    if (nextBtn) {
      nextBtn.disabled = currentPage >= totalPages || totalPages === 0;
      nextBtn.classList.toggle('disabled', nextBtn.disabled);
    }
    if (!pageNumbers) return;

    pageNumbers.replaceChildren();
    for (let page = 1; page <= totalPages; page += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `page-btn${page === currentPage ? ' active' : ''}`;
      button.textContent = String(page);
      button.setAttribute('aria-label', `Page ${page}`);
      button.setAttribute('aria-current', page === currentPage ? 'page' : 'false');
      button.addEventListener('click', () => {
        if (page === currentPage) return;
        currentPage = page;
        loadUnits();
      });
      pageNumbers.appendChild(button);
    }
  }

  if (previousBtn) {
    previousBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage -= 1;
        loadUnits();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentPage += 1;
      loadUnits();
    });
  }

  if (exportBtn && exportMenu) {
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      exportMenu.classList.remove('show');
    });
  }

  function getExportData() {
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    return rows
      .map(tr => {
        const cols = tr.querySelectorAll('td');
        if (cols.length < 10) return null;
        return {
          index: cols[0].innerText,
          smartAlias: cols[1].innerText,
          unitName: cols[2].innerText,
          property: cols[3].innerText,
          landlord: cols[4].innerText,
          unitType: cols[5].innerText,
          unitCategory: cols[6].innerText,
          tenant: cols[7].innerText,
          vacancy: cols[8].innerText,
          status: cols[9].innerText,
        };
      })
      .filter(Boolean);
  }

  const exportCsvBtn = document.getElementById('export-csv');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const data = getExportData();
      if (data.length === 0) return alert('No data available to export.');

      const headers = ['#', 'Smart Alias', 'Unit Name', 'Property', 'Landlord', 'Unit Type', 'Unit Category', 'Tenant', 'Vacancy', 'Status'];
      const csvRows = [headers.join(',')];

      data.forEach(row => {
        const values = [
          `"${row.index}"`,
          `"${row.smartAlias}"`,
          `"${row.unitName}"`,
          `"${row.property}"`,
          `"${row.landlord}"`,
          `"${row.unitType}"`,
          `"${row.unitCategory}"`,
          `"${row.tenant}"`,
          `"${row.vacancy}"`,
          `"${row.status}"`,
        ];
        csvRows.push(values.join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', 'units_report.csv');
      a.click();
    });
  }

  const exportExcelBtn = document.getElementById('export-excel');
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const data = getExportData();
      if (data.length === 0) return alert('No data available to export.');

      let html = '<table><tr><th>#</th><th>Smart Alias</th><th>Unit Name</th><th>Property</th><th>Landlord</th><th>Unit Type</th><th>Unit Category</th><th>Tenant</th><th>Vacancy</th><th>Status</th></tr>';
      data.forEach(row => {
        html += `<tr><td>${row.index}</td><td>${row.smartAlias}</td><td>${row.unitName}</td><td>${row.property}</td><td>${row.landlord}</td><td>${row.unitType}</td><td>${row.unitCategory}</td><td>${row.tenant}</td><td>${row.vacancy}</td><td>${row.status}</td></tr>`;
      });
      html += '</table>';

      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'units_report.xls';
      a.click();
    });
  }

  const exportPdfBtn = document.getElementById('export-pdf');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.print();
    });
  }

  let debounceTimer;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentPage = 1;
        loadUnits();
      }, 300);
    });
  }

  if (propertyFilter) propertyFilter.addEventListener('change', () => { currentPage = 1; loadUnits(); });
  if (landlordFilter) landlordFilter.addEventListener('change', () => { currentPage = 1; loadUnits(); });
  if (vacancyFilter) vacancyFilter.addEventListener('change', () => { currentPage = 1; loadUnits(); });
  if (statusFilter) statusFilter.addEventListener('change', () => { currentPage = 1; loadUnits(); });

  if (entriesSelect) {
    entriesSelect.addEventListener('change', () => {
      rowsPerPage = parseInt(entriesSelect.value, 10) || 50;
      currentPage = 1;
      loadUnits();
    });
  }

  async function init() {
    await loadPropertiesFilter();
    await loadLandlordsFilter();
    await loadUnits();
  }

  init();
});