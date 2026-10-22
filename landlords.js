document.addEventListener('DOMContentLoaded', () => {

  // Global cache for loaded landlords
  let cachedLandlords = [];

  // --- 1. Top Bar Menu Toggle Event ---
  const sidebarToggle = document.getElementById('toggle-sidebar');
  const sidebar = document.getElementById('sidebar');

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  // --- 2. Action Buttons Dropdowns Handler ---
  const setupDropdown = (buttonId, menuId) => {
    const btn = document.getElementById(buttonId);
    const menu = document.getElementById(menuId);
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const parent = btn.closest('.dropdown-container');
      
      document.querySelectorAll('.dropdown-container').forEach(c => {
        if (c !== parent) c.classList.remove('open');
      });

      parent.classList.toggle('open');
    });
  };

  setupDropdown('status-dropdown-btn', 'status-dropdown-menu');
  setupDropdown('export-dropdown-btn', 'export-dropdown-menu');

  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-container').forEach(c => {
      c.classList.remove('open');
    });
  });

  // --- 3. Backend Table Load & Filtering ---
  const tableBody = document.querySelector('#landlords-table tbody');
  const searchInput = document.getElementById('table-search');
  const tableInfo = document.getElementById('table-info');

  function renderTable(landlords) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!landlords || landlords.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:15px;">No landlords found</td></tr>`;
      if (tableInfo) tableInfo.textContent = 'Showing 0 entries';
      return;
    }

    landlords.forEach((item, index) => {
      const row = document.createElement('tr');
      
      // Primary Key ID used for backend API queries
      const primaryId = item.id;
      // Formatted Landlord String (e.g., LL-1001) used for UI display
      const displayId = item.landlord_id || item.landlord_number || item.id || 'N/A';
      
      // Target redirect URL built with specific landlord identifier
      const targetUrl = `landlord-details.html?id=${primaryId}&landlord_id=${encodeURIComponent(displayId)}`;

      row.innerHTML = `
        <td>${index + 1}</td>
        <td>
          <a href="${targetUrl}" 
             class="link-dashed landlord-detail-link" 
             data-url="${targetUrl}"
             style="cursor: pointer; text-decoration: underline;">
            <strong>${displayId}</strong>
          </a>
        </td>
        <td><strong>${item.name || `${item.first_name || ''} ${item.last_name || ''}`}</strong></td>
        <td>${(item.gender || '').toUpperCase()}</td>
        <td>${item.physical_address || item.address || ''}</td>
        <td>${item.registration_date || item.created_at || ''}</td>
        <td>${item.properties_count || item.total_properties || 0} PLOT(S)</td>
        <td><span class="badge badge-success">${item.status || 'active'}</span></td>
      `;
      tableBody.appendChild(row);
    });

    if (tableInfo) {
      tableInfo.textContent = `Showing 1 to ${landlords.length} of ${landlords.length} entries`;
    }
  }

  // Handle redirect via Event Delegation to prevent event cancellation issues
  if (tableBody) {
    tableBody.addEventListener('click', (e) => {
      const link = e.target.closest('.landlord-detail-link');
      if (link) {
        e.preventDefault();
        e.stopPropagation();
        const targetUrl = link.getAttribute('data-url');
        if (targetUrl) {
          window.location.href = targetUrl;
        }
      }
    });
  }

  async function loadLandlords(query = '') {
    try {
      const queryParam = query ? `?search=${encodeURIComponent(query)}` : '';
      const data = await fetchAPI(`/properties/landlords/${queryParam}`);
      cachedLandlords = data.results || data || [];
      renderTable(cachedLandlords);
    } catch (err) {
      console.error('Failed to fetch landlords:', err);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red; padding:15px;">Error loading API: ${err.message}</td></tr>`;
      }
    }
  }

  // Automatic Landlord Number Generation logic (e.g. LL-1001)
  function generateNextLandlordId() {
    if (cachedLandlords && cachedLandlords.length > 0) {
      const numericIds = cachedLandlords
        .map(item => {
          const rawId = String(item.landlord_id || item.landlord_number || '');
          const match = rawId.match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        })
        .filter(n => !isNaN(n));

      const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 1000;
      return `LL-${maxId + 1}`;
    }
    return `LL-${1001}`;
  }

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadLandlords(searchInput.value.trim()), 300);
    });
  }

  // --- 4. New Landlord Modal Popup Controls ---
  const newLandlordBtn = document.getElementById('new-landlord-btn');
  const modalOverlay = document.getElementById('landlord-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const createForm = document.getElementById('create-landlord-form');

  const openModal = () => {
    if (modalOverlay) {
      modalOverlay.classList.add('active');

      // Set current date
      const regDateInput = document.getElementById('registration_date');
      if (regDateInput && !regDateInput.value) {
        regDateInput.value = new Date().toISOString().split('T')[0];
      }

      // Auto-generate Landlord ID
      const landlordIdInput = document.getElementById('landlord_id');
      if (landlordIdInput) {
        landlordIdInput.value = generateNextLandlordId();
      }
    }
  };

  const closeModal = () => {
    if (modalOverlay) {
      modalOverlay.classList.remove('active');
    }
  };

  if (newLandlordBtn) newLandlordBtn.addEventListener('click', openModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const rawData = new FormData(createForm);
      const payload = {};

      // Filter empty inputs
      for (let [key, value] of rawData.entries()) {
        if (value instanceof File) {
          if (value.size > 0) payload[key] = value;
        } else if (typeof value === 'string' && value.trim() !== '') {
          payload[key] = value.trim();
        }
      }

      // Format gender value to DRF choice key ('MALE', 'FEMALE', 'OTHER')
      if (payload.gender) {
        const val = payload.gender.toUpperCase();
        if (val.startsWith('F')) {
          payload.gender = 'FEMALE';
        } else if (val.startsWith('M')) {
          payload.gender = 'MALE';
        } else {
          payload.gender = 'OTHER';
        }
      }

      try {
        await fetchAPI('/properties/landlords/', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        alert('Landlord saved successfully!');
        closeModal();
        createForm.reset();
        await loadLandlords();
      } catch (err) {
        console.error('Submission Error:', err);
        alert(`Failed to save landlord:\n\n${err.message}`);
      }
    });
  }

  loadLandlords();
});