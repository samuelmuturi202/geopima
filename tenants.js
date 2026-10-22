document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const tableBody = document.getElementById('table-body');
  const searchInput = document.getElementById('table-search');
  const entriesSelect = document.getElementById('entries-per-page');
  const tableInfo = document.getElementById('table-info');
  const exportBtn = document.getElementById('export-btn');
  const exportMenu = document.getElementById('export-menu');
  const agreementsBtn = document.getElementById('agreements-btn');

  // Filters
  const propertyFilter = document.getElementById('filter-property');
  const clusterFilter = document.getElementById('filter-cluster');
  const statusLinks = document.querySelectorAll('.status-link');

  // Pagination Elements
  const pageNumbersContainer = document.getElementById('page-numbers');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');

  // Modal Elements for New Tenant Workflow
  const newTenantBtn = document.getElementById('new-tenant-btn');
  const selectUnitModal = document.getElementById('selectUnitModal');
  const tenantFormModal = document.getElementById('tenantFormModal');
  const modalPropertySelect = document.getElementById('modalPropertySelect');
  const modalUnitSelect = document.getElementById('modalUnitSelect');
  const unitSelectionContinueBtn = document.getElementById('unitSelectionContinueBtn');
  const closeSelectUnitModalBtn = document.getElementById('closeSelectUnitModalBtn');
  const cancelSelectUnitModalBtn = document.getElementById('cancelSelectUnitModalBtn');
  const closeTenantModalBtn = document.getElementById('closeTenantModalBtn');
  const cancelTenantModalBtn = document.getElementById('cancelTenantModalBtn');
  const createTenantForm = document.getElementById('createTenantForm');

  let selectedUnitData = null;
  let currentTenantsCache = []; // Cache loaded tenants for export actions

  // Page State
  let currentPage = 1;
  let rowsPerPage = parseInt(entriesSelect ? entriesSelect.value : 10, 10);
  let activeStatusFilter = 'active';
  let totalEntriesCount = 0;

  // ================= POPULATE FILTER DROPDOWN =================
  async function loadFilterProperties() {
    if (!propertyFilter) return;

    try {
      const response = await fetchAPI('/properties/');
      const properties = response.results || response;

      // Keep default "All" option, then append database properties
      propertyFilter.innerHTML = '<option value="All">All Properties</option>';

      if (properties && properties.length > 0) {
        properties.forEach(prop => {
          const propName = prop.name || prop.property_name || prop.title;
          if (propName) {
            const option = document.createElement('option');
            option.value = propName;
            option.textContent = propName;
            propertyFilter.appendChild(option);
          }
        });
      }
    } catch (err) {
      console.error('Error loading filter properties:', err);
    }
  }

  async function loadTenants() {
    if (!tableBody) return;

    try {
      const query = searchInput ? searchInput.value.trim() : '';
      const selectedProp = propertyFilter ? propertyFilter.value : 'All';
      const selectedCluster = clusterFilter ? clusterFilter.value : 'All';

      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('page_size', rowsPerPage);

      if (query) params.append('search', query);
      if (selectedProp && selectedProp !== 'All') params.append('property', selectedProp);
      if (selectedCluster && selectedCluster !== 'All') params.append('cluster', selectedCluster);
      if (activeStatusFilter && activeStatusFilter !== 'All') params.append('status', activeStatusFilter);

      // Uses the global fetchAPI from js/api.js automatically
      const response = await fetchAPI(`/tenants/tenants/?${params.toString()}`);
      const tenants = response.results || response;
      currentTenantsCache = tenants;
      totalEntriesCount = response.count || tenants.length;

      renderTable(tenants, totalEntriesCount);
      renderPagination(totalEntriesCount);
    } catch (err) {
      console.error('Failed to load tenants:', err);
      tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center; color:red; padding:20px;">Error loading tenants from server: ${err.message}</td></tr>`;
    }
  }

  function renderTable(items, totalEntries) {
    tableBody.innerHTML = '';

    if (!items || items.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 20px;">No tenants found matching criteria.</td></tr>`;
      if (tableInfo) tableInfo.textContent = 'Showing 0 to 0 of 0 entries';
      return;
    }

    const start = (currentPage - 1) * rowsPerPage;

    items.forEach((row, index) => {
      const tr = document.createElement('tr');
      const tenantIdStr = row.tenantId || row.tenant_number || '';
      const tenantName = row.name || `${row.first_name || ''} ${row.last_name || ''}`;
      const landlordName = row.landlord_name || row.landlord || '-';
      const propertyName = row.property_name || row.property || '-';
      const entryDate = row.entry_date || row.entryDate || row.created_at || '-';

      tr.innerHTML = `
        <td>${start + index + 1}</td>
        <td><a href="#" class="link-code" data-id="${row.id || tenantIdStr}">${tenantIdStr}</a></td>
        <td>${tenantName}</td>
        <td>${row.cluster || '-'}</td>
        <td><a href="#" class="link-text">${landlordName}</a></td>
        <td><a href="#" class="link-text">${propertyName}</a></td>
        <td>${row.unit_name || row.unit || '-'}</td>
        <td>${row.contact || row.phone_number || '-'}</td>
        <td>${entryDate}</td>
        <td>${row.dueDate || row.due_date || 5}</td>
        <td class="text-center"><span class="badge-solid-active">${row.status || 'active'}</span></td>
      `;

      const codeLink = tr.querySelector('.link-code');
      if (codeLink) {
        codeLink.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = `tenant-detail.html?id=${row.id}`;
        });
      }

      tableBody.appendChild(tr);
    });

    const actualEnd = Math.min(start + items.length, totalEntries);
    if (tableInfo) {
      tableInfo.textContent = `Showing ${start + 1} to ${actualEnd} of ${totalEntries} entries`;
    }
  }

  // ================= DYNAMIC PAGINATION CONTROLS =================
  function renderPagination(totalEntries) {
    if (!pageNumbersContainer) return;
    pageNumbersContainer.innerHTML = '';

    const totalPages = Math.ceil(totalEntries / rowsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    if (btnPrev) {
      btnPrev.classList.toggle('disabled', currentPage === 1);
    }

    if (btnNext) {
      btnNext.classList.toggle('disabled', currentPage === totalPages || totalPages === 0);
    }

    for (let i = 1; i <= totalPages; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
      pageBtn.textContent = i;
      pageBtn.addEventListener('click', () => {
        currentPage = i;
        loadTenants();
      });
      pageNumbersContainer.appendChild(pageBtn);
    }
  }

  if (btnPrev) {
    btnPrev.onclick = () => {
      if (currentPage > 1) {
        currentPage--;
        loadTenants();
      }
    };
  }

  if (btnNext) {
    btnNext.onclick = () => {
      const totalPages = Math.ceil(totalEntriesCount / rowsPerPage) || 1;
      if (currentPage < totalPages) {
        currentPage++;
        loadTenants();
      }
    };
  }

  // ================= EXPORT ACTIONS & DROPDOWN =================
  if (exportBtn && exportMenu) {
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      exportMenu.classList.remove('show');
    });
  }

  document.getElementById('export-excel')?.addEventListener('click', (e) => {
    e.preventDefault();
    exportTableToCSV('tenants_export.csv');
  });

  document.getElementById('export-csv')?.addEventListener('click', (e) => {
    e.preventDefault();
    exportTableToCSV('tenants_export.csv');
  });

  document.getElementById('export-pdf')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.print();
  });

  function exportTableToCSV(filename) {
    if (!currentTenantsCache || currentTenantsCache.length === 0) {
      alert('No data available to export.');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Tenant ID,Name,Cluster,Landlord,Property,Unit,Contact,Entry Date,Due Date,Status\n";
    
    currentTenantsCache.forEach(row => {
      const tId = row.tenantId || row.tenant_number || '';
      const tName = `"${(row.name || `${row.first_name || ''} ${row.last_name || ''}`).replace(/"/g, '""')}"`;
      const cluster = `"${(row.cluster || '-').replace(/"/g, '""')}"`;
      const landlord = `"${(row.landlord_name || row.landlord || '-').replace(/"/g, '""')}"`;
      const property = `"${(row.property_name || row.property || '-').replace(/"/g, '""')}"`;
      const unit = `"${(row.unit_name || row.unit || '-').replace(/"/g, '""')}"`;
      const contact = `"${(row.contact || row.phone_number || '-').replace(/"/g, '""')}"`;
      const entryDate = row.entry_date || row.entryDate || row.created_at || '-';
      const dueDate = row.dueDate || row.due_date || 5;
      const status = row.status || 'active';

      csvContent += [tId, tName, cluster, landlord, property, unit, contact, entryDate, dueDate, status].join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ================= AGREEMENTS LIST BUTTON =================
  if (agreementsBtn) {
    agreementsBtn.addEventListener('click', () => {
      alert('Opening Tenant Agreements Master List...');
    });
  }

  // ================= NEW TENANT WORKFLOW LOGIC =================
  if (newTenantBtn) {
    newTenantBtn.addEventListener('click', () => {
      if (selectUnitModal) selectUnitModal.style.display = 'block';
      loadModalProperties();
    });
  }

  async function loadModalProperties() {
    try {
      const response = await fetchAPI('/properties/');
      const properties = response.results || response;
      
      if (modalPropertySelect) {
        modalPropertySelect.innerHTML = '<option value="">--Select Property--</option>';
        
        if (!properties || properties.length === 0) return;

        properties.forEach(prop => {
          const propName = prop.name || prop.property_name || prop.title;
          const propId = prop.id;

          if (propName && propId !== undefined) {
            const option = document.createElement('option');
            option.value = propName; 
            option.dataset.propertyId = propId;
            option.textContent = propName;
            modalPropertySelect.appendChild(option);
          }
        });
      }
    } catch (err) {
      console.error('Error loading properties for modal:', err);
    }
  }

  if (modalPropertySelect) {
    modalPropertySelect.addEventListener('change', async () => {
      const selectedOption = modalPropertySelect.options[modalPropertySelect.selectedIndex];
      const propertyId = selectedOption ? selectedOption.dataset.propertyId : null;

      if (modalUnitSelect) {
        modalUnitSelect.innerHTML = '<option value="">--Select Property First--</option>';
        modalUnitSelect.disabled = true;
      }
      if (unitSelectionContinueBtn) {
        unitSelectionContinueBtn.disabled = true;
        unitSelectionContinueBtn.style.opacity = '0.6';
      }

      if (!propertyId) return;

      try {
        const response = await fetchAPI(`/properties/units/?property=${encodeURIComponent(propertyId)}&vacancy=vacant`);
        const units = response.results || response;

        if (modalUnitSelect) {
          if (units && units.length > 0) {
            modalUnitSelect.innerHTML = '<option value="">--Select Unit--</option>';
            units.forEach(unit => {
              const option = document.createElement('option');
              option.value = unit.id; 
              option.dataset.unitDetails = JSON.stringify(unit);
              option.textContent = unit.unit_name || unit.unit_no || 'Unnamed Unit';
              modalUnitSelect.appendChild(option);
            });
            modalUnitSelect.disabled = false;
            modalUnitSelect.style.background = '#fff';
          } else {
            modalUnitSelect.innerHTML = '<option value="">No vacant units available</option>';
          }
        }
      } catch (err) {
        console.error('Error fetching units:', err);
      }
    });
  }

  if (modalUnitSelect) {
    modalUnitSelect.addEventListener('change', () => {
      if (modalUnitSelect.value) {
        if (unitSelectionContinueBtn) {
          unitSelectionContinueBtn.disabled = false;
          unitSelectionContinueBtn.style.opacity = '1';
        }
        const selectedOption = modalUnitSelect.options[modalUnitSelect.selectedIndex];
        selectedUnitData = JSON.parse(selectedOption.dataset.unitDetails);
      } else {
        if (unitSelectionContinueBtn) {
          unitSelectionContinueBtn.disabled = true;
          unitSelectionContinueBtn.style.opacity = '0.6';
        }
        selectedUnitData = null;
      }
    });
  }

  if (unitSelectionContinueBtn) {
    unitSelectionContinueBtn.addEventListener('click', () => {
      if (!selectedUnitData) return;

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      };

      setVal('displayUnitId', selectedUnitData.unit_no || selectedUnitData.id);
      setVal('displayUnitName', selectedUnitData.unit_name || 'N/A');
      setVal('displayUnitType', selectedUnitData.unit_type || 'Residential');
      setVal('displayUnitCategory', selectedUnitData.unit_category || 'Single Room');
      setVal('displayRent', selectedUnitData.rent || '0.00');

      if (selectUnitModal) selectUnitModal.style.display = 'none';
      if (tenantFormModal) tenantFormModal.style.display = 'block';
    });
  }

  // Modal Close and Cancel Handlers
  const closeSelectUnitModal = () => { if (selectUnitModal) selectUnitModal.style.display = 'none'; };
  const closeTenantFormModal = () => { if (tenantFormModal) tenantFormModal.style.display = 'none'; };

  if (closeSelectUnitModalBtn) closeSelectUnitModalBtn.addEventListener('click', closeSelectUnitModal);
  if (cancelSelectUnitModalBtn) cancelSelectUnitModalBtn.addEventListener('click', closeSelectUnitModal);
  if (closeTenantModalBtn) closeTenantModalBtn.addEventListener('click', closeTenantFormModal);
  if (cancelTenantModalBtn) cancelTenantModalBtn.addEventListener('click', closeTenantFormModal);

  window.addEventListener('click', (e) => {
    if (selectUnitModal && e.target === selectUnitModal) selectUnitModal.style.display = 'none';
    if (tenantFormModal && e.target === tenantFormModal) tenantFormModal.style.display = 'none';
  });

  // Handle Form Submission via API (Supports FormData for files like image & agreement)
  if (createTenantForm) {
    createTenantForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(createTenantForm);

      if (selectedUnitData) {
        formData.append('unit', selectedUnitData.id);
      }

      try {
        await fetchAPI('/tenants/tenants/', {
          method: 'POST',
          body: formData
        });

        alert('Tenant created successfully!');
        if (tenantFormModal) tenantFormModal.style.display = 'none';
        createTenantForm.reset();
        loadTenants();
      } catch (err) {
        console.error('Error saving tenant:', err);
        alert('Failed to save tenant: ' + err.message);
      }
    });
  }

  // Event Listeners for Table Controls & Toolbar
  statusLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      statusLinks.forEach(l => l.classList.remove('active'));
      e.target.classList.add('active');
      activeStatusFilter = e.target.dataset.status;
      currentPage = 1;
      loadTenants();
    });
  });

  let debounceTimer;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentPage = 1;
        loadTenants();
      }, 300);
    });
  }

  if (propertyFilter) propertyFilter.addEventListener('change', () => { currentPage = 1; loadTenants(); });
  if (clusterFilter) clusterFilter.addEventListener('change', () => { currentPage = 1; loadTenants(); });

  if (entriesSelect) {
    entriesSelect.addEventListener('change', () => {
      rowsPerPage = parseInt(entriesSelect.value, 10);
      currentPage = 1;
      loadTenants();
    });
  }

  // Initial Load Actions
  loadFilterProperties();
  loadTenants();
});