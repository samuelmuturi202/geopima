document.addEventListener('DOMContentLoaded', () => {

  // Exact dataset extracted from screenshot
  const tenantsData = [
    { id: 1, tenantId: 'W4597', name: 'Francis Salano', cluster: 'Cluster A', landlord: 'Harrison Nganga', property: 'Harrison Plot', unit: 'H5', contact: '254758887219', entryDate: '2026-08-07', dueDate: 5, status: 'active' },
    { id: 2, tenantId: 'W4596', name: 'Amadadi Clinton', cluster: 'Cluster A', landlord: 'Nancy Kabiria', property: 'Nancy Kabiria Plot', unit: 'C1', contact: '254768478589', entryDate: '2026-08-07', dueDate: 5, status: 'active' },
    { id: 3, tenantId: 'W4595', name: 'Bruce-lee', cluster: 'Cluster A', landlord: 'Nancy Kabiria', property: 'Nancy Kabiria Plot', unit: 'G5', contact: '254791068103', entryDate: '2026-08-07', dueDate: 5, status: 'active' },
    { id: 4, tenantId: 'W4594', name: 'Alfred', cluster: 'Cluster A', landlord: 'Samuel Njoroge', property: 'HENRY NJOROGE', unit: 'H7', contact: '254728069850', entryDate: '2026-08-07', dueDate: 5, status: 'active' },
    { id: 5, tenantId: 'W4593', name: 'Douglas Ombeka', cluster: 'Cluster A', landlord: 'JOSPHINE', property: 'JOSPHINE', unit: 'B3', contact: '254721558766', entryDate: '2026-08-07', dueDate: 5, status: 'active' },
    { id: 6, tenantId: 'W4592', name: 'Nicholas', cluster: 'Cluster A', landlord: 'Kariuki Waweru', property: 'Kariuki Waweru B', unit: 'B7', contact: '254745175838', entryDate: '2026-08-07', dueDate: 5, status: 'active' },
    { id: 7, tenantId: 'W4591', name: 'Beja Baraka', cluster: 'Cluster A', landlord: 'JOHN', property: 'JOHN', unit: 'H4', contact: '254717625069', entryDate: '2026-08-06', dueDate: 5, status: 'active' },
    { id: 8, tenantId: 'W4590', name: 'Resuk Ngandi', cluster: 'Cluster A', landlord: 'Jane Kanana', property: 'Kanana Plot', unit: 'C14', contact: '254745359271', entryDate: '2026-08-06', dueDate: 5, status: 'active' },
    { id: 9, tenantId: 'W4589', name: 'Isaac Mbeehe', cluster: 'Cluster A', landlord: 'Jane Kanana', property: 'Kanana Plot', unit: 'D1', contact: '254717643582', entryDate: '2026-08-06', dueDate: 5, status: 'active' },
    { id: 10, tenantId: 'W4588', name: 'Stanley Mwaniki', cluster: 'Cluster A', landlord: 'JOSPHINE', property: 'JOSPHINE', unit: 'B10', contact: '254713348869', entryDate: '2026-08-06', dueDate: 5, status: 'active' },
    { id: 11, tenantId: 'W4587', name: 'Stalon', cluster: 'Cluster A', landlord: 'Dorothy / Rono', property: 'Dorothy', unit: 'F4', contact: '254728689043', entryDate: '2026-08-06', dueDate: 5, status: 'active' },
    { id: 12, tenantId: 'W4586', name: 'Titus Ndombi', cluster: 'Cluster A', landlord: 'Dorothy / Rono', property: 'Dorothy', unit: 'B16', contact: '254727463284', entryDate: '2026-08-06', dueDate: 5, status: 'active' }
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
  const clusterFilter = document.getElementById('filter-cluster');
  const statusLinks = document.querySelectorAll('.status-link');

  // Page State
  let filteredData = [...tenantsData];
  let currentPage = 1;
  let rowsPerPage = parseInt(entriesSelect.value);
  let activeStatusFilter = 'active';

  // Render Table Rows
  function renderTable() {
    tableBody.innerHTML = '';

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedItems = filteredData.slice(start, end);

    if (paginatedItems.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 20px;">No tenants found matching criteria.</td></tr>`;
      tableInfo.textContent = 'Showing 0 to 0 of 0 entries';
      return;
    }

    paginatedItems.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${start + index + 1}</td>
        <td><a href="#" class="link-code">${row.tenantId}</a></td>
        <td>${row.name}</td>
        <td>${row.cluster}</td>
        <td><a href="#" class="link-text">${row.landlord}</a></td>
        <td><a href="#" class="link-text">${row.property}</a></td>
        <td>${row.unit}</td>
        <td>${row.contact}</td>
        <td>${row.entryDate}</td>
        <td>${row.dueDate}</td>
        <td class="text-center"><span class="badge-solid-active">${row.status}</span></td>
      `;
      tableBody.appendChild(tr);
    });

    const totalEntries = filteredData.length;
    const actualEnd = Math.min(end, totalEntries);
    tableInfo.textContent = `Showing ${start + 1} to ${actualEnd} of ${totalEntries} entries`;
  }

  // Filter Logic
  function applyFilters() {
    const query = searchInput.value.toLowerCase().trim();
    const selectedProp = propertyFilter.value;
    const selectedCluster = clusterFilter.value;

    filteredData = tenantsData.filter(item => {
      const matchesSearch = 
        item.tenantId.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.landlord.toLowerCase().includes(query) ||
        item.property.toLowerCase().includes(query) ||
        item.contact.includes(query);

      const matchesProperty = selectedProp === 'All' || item.property === selectedProp;
      const matchesCluster = selectedCluster === 'All' || item.cluster === selectedCluster;
      const matchesStatus = activeStatusFilter === 'All' || item.status === activeStatusFilter;

      return matchesSearch && matchesProperty && matchesCluster && matchesStatus;
    });

    currentPage = 1;
    renderTable();
  }

  // Event Listeners
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    exportMenu.classList.remove('show');
  });

  statusLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      statusLinks.forEach(l => l.classList.remove('active'));
      e.target.classList.add('active');
      activeStatusFilter = e.target.dataset.status;
      applyFilters();
    });
  });

  searchInput.addEventListener('input', applyFilters);
  propertyFilter.addEventListener('change', applyFilters);
  clusterFilter.addEventListener('change', applyFilters);

  entriesSelect.addEventListener('change', () => {
    rowsPerPage = parseInt(entriesSelect.value);
    currentPage = 1;
    renderTable();
  });

  // Initial Load
  renderTable();
});