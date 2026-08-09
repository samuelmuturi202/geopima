document.addEventListener('DOMContentLoaded', () => {

  // Mock Data representation from image
  const unitsData = [
    { id: 1, unitNo: 'WU0001', unitName: 'H1', property: 'Mary Mwihaki Plot', landlord: 'Mary Mwihaki', unitType: 'Single Room', unitCategory: 'Residential', tenant: 'Maureen', vacancy: 'occupied', status: 'Active' },
    { id: 2, unitNo: 'WU0002', unitName: 'H2', property: 'Mary Mwihaki Plot', landlord: 'Mary Mwihaki', unitType: 'Single Room', unitCategory: 'Residential', tenant: 'Agnes', vacancy: 'occupied', status: 'Active' },
    { id: 3, unitNo: 'WU0003', unitName: 'H3', property: 'Mary Mwihaki Plot', landlord: 'Mary Mwihaki', unitType: 'Single Room', unitCategory: 'Residential', tenant: 'Alex', vacancy: 'occupied', status: 'Active' },
    { id: 4, unitNo: 'WU0004', unitName: 'H4', property: 'Mary Mwihaki Plot', landlord: 'Mary Mwihaki', unitType: 'Single Room', unitCategory: 'Residential', tenant: 'BENARD', vacancy: 'occupied', status: 'Active' },
    { id: 5, unitNo: 'WU0005', unitName: 'H5', property: 'Mary Mwihaki Plot', landlord: 'Mary Mwihaki', unitType: 'Single Room', unitCategory: 'Residential', tenant: 'Elly', vacancy: 'occupied', status: 'Active' },
    { id: 6, unitNo: 'WU0006', unitName: 'H6', property: 'Mary Mwihaki Plot', landlord: 'Mary Mwihaki', unitType: 'Single Room', unitCategory: 'Residential', tenant: 'Hilary', vacancy: 'occupied', status: 'Active' },
    { id: 7, unitNo: 'WU0007', unitName: 'H7', property: 'Mary Mwihaki Plot', landlord: 'Mary Mwihaki', unitType: 'Single Room', unitCategory: 'Residential', tenant: 'Victor', vacancy: 'occupied', status: 'Active' },
    { id: 8, unitNo: 'WU0008', unitName: 'H8', property: 'Mary Mwihaki Plot', landlord: 'Mary Mwihaki', unitType: 'Single Room', unitCategory: 'Residential', tenant: 'William', vacancy: 'occupied', status: 'Active' },
    { id: 9, unitNo: 'WU0009', unitName: 'H9', property: 'Mary Mwihaki Plot', landlord: 'Mary Mwihaki', unitType: 'Single Room', unitCategory: 'Residential', tenant: 'Clan', vacancy: 'occupied', status: 'Active' },
    { id: 10, unitNo: 'WU0010', unitName: 'H10', property: 'Mary Mwihaki Plot', landlord: 'Mary Mwihaki', unitType: 'Single Room', unitCategory: 'Residential', tenant: 'Elizabeth', vacancy: 'occupied', status: 'Active' }
  ];

  // DOM Elements
  const tableBody = document.getElementById('table-body');
  const searchInput = document.getElementById('table-search');
  const entriesSelect = document.getElementById('entries-per-page');
  const tableInfo = document.getElementById('table-info');
  const exportBtn = document.getElementById('export-btn');
  const exportMenu = document.getElementById('export-menu');

  // Filters
  const propertyFilter = document.getElementById('filter-property');
  const landlordFilter = document.getElementById('filter-landlord');
  const vacancyFilter = document.getElementById('filter-vacancy');
  const statusFilter = document.getElementById('filter-status');

  // Page State variables
  let filteredData = [...unitsData];
  let currentPage = 1;
  let rowsPerPage = parseInt(entriesSelect.value);

  // Render Table
  function renderTable() {
    tableBody.innerHTML = '';

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedItems = filteredData.slice(start, end);

    if (paginatedItems.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 20px;">No units found matching criteria.</td></tr>`;
      tableInfo.textContent = 'Showing 0 to 0 of 0 entries';
      return;
    }

    paginatedItems.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${start + index + 1}</td>
        <td><a href="#" class="link-code">${row.unitNo}</a></td>
        <td>${row.unitName}</td>
        <td><a href="#" class="link-text">${row.property}</a></td>
        <td><a href="#" class="link-text">${row.landlord}</a></td>
        <td>${row.unitType}</td>
        <td>${row.unitCategory}</td>
        <td><a href="#" class="link-text">${row.tenant}</a></td>
        <td class="text-center"><span class="badge-outline-occupied">${row.vacancy}</span></td>
        <td class="text-center"><span class="badge-solid-active">${row.status.toLowerCase()}</span></td>
      `;
      tableBody.appendChild(tr);
    });

    // Update Footer Info
    const totalEntries = filteredData.length;
    const actualEnd = Math.min(end, totalEntries);
    tableInfo.textContent = `Showing ${start + 1} to ${actualEnd} of ${totalEntries} entries`;
  }

  // Filter Logic
  function applyFilters() {
    const query = searchInput.value.toLowerCase().trim();
    const selectedProp = propertyFilter.value;
    const selectedLandlord = landlordFilter.value;
    const selectedVacancy = vacancyFilter.value;
    const selectedStatus = statusFilter.value;

    filteredData = unitsData.filter(item => {
      const matchesSearch = 
        item.unitNo.toLowerCase().includes(query) ||
        item.unitName.toLowerCase().includes(query) ||
        item.property.toLowerCase().includes(query) ||
        item.landlord.toLowerCase().includes(query) ||
        item.tenant.toLowerCase().includes(query);

      const matchesProperty = selectedProp === 'All' || item.property === selectedProp;
      const matchesLandlord = selectedLandlord === 'All' || item.landlord === selectedLandlord;
      const matchesVacancy = selectedVacancy === 'All' || item.vacancy === selectedVacancy;
      const matchesStatus = selectedStatus === 'All' || item.status === selectedStatus;

      return matchesSearch && matchesProperty && matchesLandlord && matchesVacancy && matchesStatus;
    });

    currentPage = 1;
    renderTable();
  }

  // Toggle Export Menu
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    exportMenu.classList.remove('show');
  });

  // Event Listeners for Filtering
  searchInput.addEventListener('input', applyFilters);
  propertyFilter.addEventListener('change', applyFilters);
  landlordFilter.addEventListener('change', applyFilters);
  vacancyFilter.addEventListener('change', applyFilters);
  statusFilter.addEventListener('change', applyFilters);

  entriesSelect.addEventListener('change', () => {
    rowsPerPage = parseInt(entriesSelect.value);
    currentPage = 1;
    renderTable();
  });

  // Initial Load
  renderTable();
});