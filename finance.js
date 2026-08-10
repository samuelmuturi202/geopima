document.addEventListener('DOMContentLoaded', () => {

  // 1. Export Button Dropdown Logic
  const exportDropdown = document.getElementById('export-dropdown');
  const exportToggleBtn = document.getElementById('export-toggle-btn');
  const exportExcelBtn = document.getElementById('export-excel-btn');
  const exportPdfBtn = document.getElementById('export-pdf-btn');

  if (exportToggleBtn && exportDropdown) {
    exportToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!exportDropdown.contains(e.target)) {
        exportDropdown.classList.remove('active');
      }
    });
  }

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', () => {
      exportDropdown.classList.remove('active');
      alert('Generating Excel report (.xlsx)...');
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      exportDropdown.classList.remove('active');
      alert('Generating PDF report (.pdf)...');
    });
  }

  // 2. Print Statement Action
  const printBtn = document.getElementById('print-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // 3. Rent Collections Mock Data
  const rentCollections = [
    {
      receiptNo: "REC-2026-0801",
      dateTime: "2026-08-01 09:14 AM",
      tenant: "Alice Njuguna",
      property: "Alice Njuguna",
      unit: "Unit B3",
      method: "Mpesa",
      refCode: "RKG8923101",
      amount: 18120,
      status: "Allocated"
    },
    {
      receiptNo: "REC-2026-0802",
      dateTime: "2026-08-02 11:30 AM",
      tenant: "Benard Njunge",
      property: "Benard Njunge A",
      unit: "Unit A1",
      method: "Mpesa",
      refCode: "RKG9012443",
      amount: 6000,
      status: "Allocated"
    },
    {
      receiptNo: "REC-2026-0803",
      dateTime: "2026-08-03 02:45 PM",
      tenant: "Charity Nduta",
      property: "Charity MUTHONI Nduta",
      unit: "Unit C5",
      method: "Bank",
      refCode: "COOP-883921",
      amount: 10850,
      status: "Allocated"
    },
    {
      receiptNo: "REC-2026-0804",
      dateTime: "2026-08-04 10:05 AM",
      tenant: "Daniel Mwangi",
      property: "Daniel mwangi",
      unit: "Unit 12",
      method: "Cash",
      refCode: "CSH-2026-012",
      amount: 6000,
      status: "Allocated"
    },
    {
      receiptNo: "REC-2026-0805",
      dateTime: "2026-08-05 04:20 PM",
      tenant: "Grace Gaitho",
      property: "Grace",
      unit: "Unit G1",
      method: "Mpesa",
      refCode: "RKG9548810",
      amount: 48000,
      status: "Allocated"
    },
    {
      receiptNo: "REC-2026-0806",
      dateTime: "2026-08-06 01:10 PM",
      tenant: "Annastacia Wanjiku",
      property: "Annastacia Plot",
      unit: "Unit 04",
      method: "Mpesa",
      refCode: "RKG9723011",
      amount: 1400,
      status: "Allocated"
    }
  ];

  const tableBody = document.getElementById('rent-table-body');
  const recordCountEl = document.getElementById('record-count');
  const searchInput = document.getElementById('search-input');
  const propertyFilter = document.getElementById('property-filter');
  const methodFilter = document.getElementById('payment-method-filter');

  // 4. Render Table Function
  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color: var(--text-dark);">No matching rent collection records found.</td></tr>`;
      if (recordCountEl) recordCountEl.textContent = 'Showing 0 transactions';
      return;
    }

    data.forEach(item => {
      const row = document.createElement('tr');
      const badgeClass = item.method === 'Mpesa' ? 'badge-mpesa' : (item.method === 'Bank' ? 'badge-bank' : 'badge-cash');

      row.innerHTML = `
        <td><strong>${item.receiptNo}</strong></td>
        <td>${item.dateTime}</td>
        <td>${item.tenant}</td>
        <td>${item.property} <br><small style="color:#777;">${item.unit}</small></td>
        <td><span class="badge ${badgeClass}">${item.method}</span></td>
        <td><code>${item.refCode}</code></td>
        <td><strong>KES ${item.amount.toLocaleString()}</strong></td>
        <td><span class="badge badge-success">${item.status}</span></td>
        <td>
          <i class="fa-solid fa-print action-icon" title="Print Receipt"></i>
          <i class="fa-solid fa-eye action-icon" title="View Details"></i>
        </td>
      `;
      tableBody.appendChild(row);
    });

    if (recordCountEl) {
      recordCountEl.textContent = `Showing ${data.length} transaction${data.length > 1 ? 's' : ''}`;
    }
  }

  // 5. Interactive Filter Handler
  function applyFilters() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedProp = propertyFilter ? propertyFilter.value : 'ALL';
    const selectedMethod = methodFilter ? methodFilter.value : 'ALL';

    const filtered = rentCollections.filter(item => {
      const matchesSearch = item.tenant.toLowerCase().includes(query) ||
                            item.receiptNo.toLowerCase().includes(query) ||
                            item.refCode.toLowerCase().includes(query) ||
                            item.unit.toLowerCase().includes(query);

      const matchesProp = (selectedProp === 'ALL') || item.property === selectedProp;
      const matchesMethod = (selectedMethod === 'ALL') || item.method === selectedMethod;

      return matchesSearch && matchesProp && matchesMethod;
    });

    renderTable(filtered);
  }

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (propertyFilter) propertyFilter.addEventListener('change', applyFilters);
  if (methodFilter) methodFilter.addEventListener('change', applyFilters);

  // Initial Table Render
  renderTable(rentCollections);

});