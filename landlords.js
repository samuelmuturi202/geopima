document.addEventListener('DOMContentLoaded', () => {
  let cachedLandlords = [];

  const sidebarToggle = document.getElementById('toggle-sidebar');
  const sidebar = document.getElementById('sidebar');

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

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

  const tableBody = document.querySelector('#landlords-table tbody');
  const searchInput = document.getElementById('table-search');
  const tableInfo = document.getElementById('table-info');
  const entriesSelect = document.getElementById('entries-select');
  const pagination = document.getElementById('landlords-pagination');
  const statusLinks = document.querySelectorAll('#status-dropdown-menu [data-status]');
  let rowsPerPage = Number(entriesSelect?.value || 100);
  let currentPage = 1;
  let currentStatus = 'active';

  function renderTable(landlords) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const filtered = (landlords || []).filter(item =>
      currentStatus === 'all' || Boolean(item.is_active) === (currentStatus === 'active')
    );
    if (!filtered.length) {
      currentPage = 1;
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:15px;">No landlords found</td></tr>`;
      if (tableInfo) tableInfo.textContent = 'Showing 0 to 0 of 0 entries';
      renderPagination(0);
      return;
    }

    const pageCount = Math.ceil(filtered.length / rowsPerPage);
    currentPage = Math.min(currentPage, pageCount);
    const start = (currentPage - 1) * rowsPerPage;
    filtered.slice(start, start + rowsPerPage).forEach((item, index) => {
      const row = document.createElement('tr');
      const primaryId = item.id;
      const displayId = item.landlord_id || item.landlord_number || item.id || 'N/A';
      const targetUrl = `landlord-details.html?id=${primaryId}&landlord_id=${encodeURIComponent(displayId)}`;

      row.innerHTML = `
        <td>${start + index + 1}</td>
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
      tableInfo.textContent = `Showing ${start + 1} to ${Math.min(start + rowsPerPage, filtered.length)} of ${filtered.length} entries`;
    }
    renderPagination(pageCount);
  }

  function renderPagination(pageCount) {
    if (!pagination) return;
    pagination.replaceChildren();
    const addButton = (label, page, disabled = false, active = false) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `page-btn${disabled ? ' disabled' : ''}${active ? ' active' : ''}`;
      button.textContent = label;
      button.disabled = disabled;
      button.addEventListener('click', () => {
        currentPage = page;
        renderTable(cachedLandlords);
      });
      item.appendChild(button);
      pagination.appendChild(item);
    };
    addButton('Previous', Math.max(1, currentPage - 1), currentPage <= 1);
    for (let page = 1; page <= pageCount; page += 1) addButton(String(page), page, false, page === currentPage);
    addButton('Next', Math.min(pageCount, currentPage + 1), currentPage >= pageCount || pageCount === 0);
  }

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
      currentPage = 1;
      renderTable(cachedLandlords);
    } catch (err) {
      console.error('Failed to fetch landlords:', err);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red; padding:15px;">Error loading API: ${err.message}</td></tr>`;
      }
    }
  }

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

  if (entriesSelect) {
    entriesSelect.addEventListener('change', () => {
      rowsPerPage = Number(entriesSelect.value);
      currentPage = 1;
      renderTable(cachedLandlords);
    });
  }
  statusLinks.forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      currentStatus = link.dataset.status;
      currentPage = 1;
      statusLinks.forEach(item => item.classList.toggle('active', item === link));
      renderTable(cachedLandlords);
    });
  });

  document.getElementById('export-landlords-csv')?.addEventListener('click', event => {
    event.preventDefault();
    window.downloadCsv('landlords.csv',
      ['Landlord ID', 'Name', 'Gender', 'Phone', 'Email', 'Address', 'Registration Date', 'Status'],
      cachedLandlords.map(item => [
        item.landlord_id,
        item.name,
        item.gender,
        item.phone_number,
        item.email,
        item.address,
        item.registration_date,
        item.is_active ? 'Active' : 'Inactive'
      ])
    );
  });
  document.getElementById('export-landlords-pdf')?.addEventListener('click', event => {
    event.preventDefault();
    window.print();
  });
  document.getElementById('print-landlords')?.addEventListener('click', event => {
    event.preventDefault();
    window.print();
  });

  const newLandlordBtn = document.getElementById('new-landlord-btn');
  const modalOverlay = document.getElementById('landlord-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const createForm = document.getElementById('create-landlord-form');
  const importCsvBtn = document.getElementById('import-landlords-btn');
  const csvFileInput = document.getElementById('landlords-csv-file');

  const openModal = () => {
    if (modalOverlay) {
      modalOverlay.classList.add('active');
      const regDateInput = document.getElementById('registration_date');
      if (regDateInput && !regDateInput.value) {
        regDateInput.value = new Date().toISOString().split('T')[0];
      }
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

      for (let [key, value] of rawData.entries()) {
        if (value instanceof File) {
          if (value.size > 0) payload[key] = value;
        } else if (typeof value === 'string' && value.trim() !== '') {
          payload[key] = value.trim();
        }
      }

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

  function parseCsv(text) {
    const records = [];
    let record = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === '"') {
        if (quoted && text[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === ',' && !quoted) {
        record.push(value.trim());
        value = '';
      } else if ((character === '\n' || character === '\r') && !quoted) {
        if (character === '\r' && text[index + 1] === '\n') index += 1;
        record.push(value.trim());
        if (record.some(field => field !== '')) records.push(record);
        record = [];
        value = '';
      } else {
        value += character;
      }
    }
    if (quoted) throw new Error('CSV contains an unclosed quoted field.');
    record.push(value.trim());
    if (record.some(field => field !== '')) records.push(record);
    if (records.length < 2) throw new Error('CSV must contain a header and at least one data row.');

    const headers = records.shift().map(header => header.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s-]+/g, '_'));
    return records.map(fields => Object.fromEntries(headers.map((header, index) => [header, fields[index] || ''])));
  }

  if (importCsvBtn && csvFileInput) {
    importCsvBtn.addEventListener('click', () => csvFileInput.click());
    csvFileInput.addEventListener('change', async () => {
      const file = csvFileInput.files?.[0];
      if (!file) return;
      csvFileInput.value = '';
      if (!file.name.toLowerCase().endsWith('.csv') || file.size > 5 * 1024 * 1024) {
        alert('Choose a CSV file no larger than 5 MB.');
        return;
      }

      try {
        const rows = parseCsv(await file.text());
        if (rows.length > 1000) throw new Error('Import is limited to 1,000 landlords per file.');
        const failures = [];
        let imported = 0;
        for (let index = 0; index < rows.length; index += 1) {
          const row = rows[index];
          const landlordId = row.landlord_id || row.landlord_number || row.id;
          const name = row.name || row.landlord_name;
          if (!landlordId || !name) {
            failures.push(`Row ${index + 2}: landlord_id and name are required.`);
            continue;
          }
          const payload = {
            landlord_id: landlordId.trim(),
            name: name.trim(),
            gender: row.gender ? row.gender.trim().toUpperCase() : 'OTHER',
            id_number: row.id_number || '',
            phone_number: row.phone_number || row.phone || '',
            secondary_contact: row.secondary_contact || '',
            email: row.email || '',
            address: row.address || row.physical_address || '',
            postal_address: row.postal_address || '',
            bank_name: row.bank_name || '',
            account_name: row.account_name || '',
            account_number: row.account_number || ''
          };
          try {
            await fetchAPI('/properties/landlords/', {
              method: 'POST',
              body: JSON.stringify(payload)
            });
            imported += 1;
          } catch (error) {
            failures.push(`Row ${index + 2} (${landlordId}): ${error.message}`);
          }
        }
        await loadLandlords(searchInput?.value.trim() || '');
        const failureSummary = failures.slice(0, 10).join('\n');
        alert(
          `Imported ${imported} of ${rows.length} landlord records.`
          + (failures.length ? `\n${failures.length} row(s) need attention:\n${failureSummary}` : '')
          + (failures.length > 10 ? `\n...and ${failures.length - 10} more.` : '')
        );
      } catch (error) {
        alert(`Could not import landlord CSV: ${error.message}`);
      }
    });
  }

  loadLandlords();
});