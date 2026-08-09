document.addEventListener('DOMContentLoaded', () => {

  // Sidebar Toggle logic
  const toggleBtn = document.getElementById('toggle-sidebar');
  const sidebar = document.getElementById('sidebar');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  // Exact Data Array matching the attached screenshot
  const invoiceData = [
    { num: 1,  invoiceNo: "INV038908", tnt: "W4576", tenant: "Alfred",               property: "JOSPHINE",          unit: "B3",   due: 5, expected: "4,500.00",  prepaid: "0.00", discount: "0.00", arrears: "0.00", current: "0.00",      paid: "4,500.00", balance: "0.00",      status: "cleared" },
    { num: 2,  invoiceNo: "INV038907", tnt: "W4575", tenant: "Noah",                 property: "JOSPHINE",          unit: "C6",   due: 5, expected: "3,500.00",  prepaid: "0.00", discount: "0.00", arrears: "0.00", current: "0.00",      paid: "7,000.00", balance: "-3,500.00", status: "cleared" },
    { num: 3,  invoiceNo: "INV038906", tnt: "W4574", tenant: "Mary Wangui Karanja",  property: "Esther wairimi B",  unit: "C306", due: 5, expected: "65,000.00", prepaid: "0.00", discount: "0.00", arrears: "0.00", current: "65,000.00", paid: "0.00",     balance: "65,000.00", status: "not_cleared" },
    { num: 4,  invoiceNo: "INV038905", tnt: "W4573", tenant: "Bruce Morgan",         property: "james wainaina",    unit: "B2",   due: 5, expected: "10,000.00", prepaid: "0.00", discount: "0.00", arrears: "0.00", current: "10,000.00", paid: "0.00",     balance: "10,000.00", status: "not_cleared" },
    { num: 5,  invoiceNo: "INV038904", tnt: "W4572", tenant: "Brian Muhambi",        property: "james wainaina",    unit: "B4",   due: 5, expected: "11,000.00", prepaid: "0.00", discount: "0.00", arrears: "0.00", current: "11,000.00", paid: "0.00",     balance: "11,000.00", status: "not_cleared" },
    { num: 6,  invoiceNo: "INV038903", tnt: "W4571", tenant: "Joy Songok",           property: "james wainaina",    unit: "B3",   due: 5, expected: "8,000.00",  prepaid: "0.00", discount: "0.00", arrears: "0.00", current: "0.00",      paid: "8,000.00", balance: "0.00",      status: "cleared" },
    { num: 7,  invoiceNo: "INV038902", tnt: "W4570", tenant: "Wahome",               property: "joseph mwangi",     unit: "S7",   due: 5, expected: "10,000.00", prepaid: "0.00", discount: "0.00", arrears: "0.00", current: "10,000.00", paid: "0.00",     balance: "10,000.00", status: "not_cleared" },
    { num: 8,  invoiceNo: "INV038901", tnt: "W4569", tenant: "Agnes",                property: "joseph mwangi",     unit: "S6",   due: 5, expected: "13,000.00", prepaid: "0.00", discount: "0.00", arrears: "0.00", current: "13,000.00", paid: "0.00",     balance: "13,000.00", status: "not_cleared" },
    { num: 9,  invoiceNo: "INV038900", tnt: "W4568", tenant: "Teresiah Njenga",      property: "joseph mwangi",     unit: "S4",   due: 5, expected: "4,000.00",  prepaid: "0.00", discount: "0.00", arrears: "0.00", current: "4,000.00",  paid: "0.00",     balance: "4,000.00",  status: "not_cleared" },
    { num: 10, invoiceNo: "INV038899", tnt: "W4567", tenant: "Susan Mbugua",         property: "joseph mwangi",     unit: "S2",   due: 5, expected: "4,000.00",  prepaid: "0.00", discount: "0.00", arrears: "0.00", current: "4,000.00",  paid: "0.00",     balance: "4,000.00",  status: "not_cleared" },
    { num: 11, invoiceNo: "INV038898", tnt: "W4566", tenant: "Robinson Kimani",      property: "joseph mwangi",     unit: "S3",   due: 5, expected: "4,000.00",  prepaid: "0.00", discount: "0.00", arrears: "0.00", current: "4,000.00",  paid: "0.00",     balance: "4,000.00",  status: "not_cleared" }
  ];

  const tbody = document.getElementById('invoice-tbody');

  function renderRows(data) {
    tbody.innerHTML = '';
    data.forEach(item => {
      const tr = document.createElement('tr');
      const statusLabel = item.status === 'cleared' ? 'cleared' : 'not_cleared';
      const statusText = item.status === 'cleared' ? 'cleared' : 'not cleared';

      tr.innerHTML = `
        <td>${item.num}</td>
        <td><a href="#">${item.invoiceNo}</a></td>
        <td><a href="#">${item.tnt}</a></td>
        <td>${item.tenant}</td>
        <td>${item.property}</td>
        <td>${item.unit}</td>
        <td>${item.due}</td>
        <td class="text-right">${item.expected}</td>
        <td class="text-right">${item.prepaid}</td>
        <td class="text-right">${item.discount}</td>
        <td class="text-right">${item.arrears}</td>
        <td class="text-right">${item.current}</td>
        <td class="text-right">${item.paid}</td>
        <td class="text-right">${item.balance}</td>
        <td><span class="status-pill ${statusLabel}">${statusText}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Real-time Search Filter
  const searchInput = document.getElementById('table-search');
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = invoiceData.filter(item => 
      item.invoiceNo.toLowerCase().includes(query) ||
      item.tnt.toLowerCase().includes(query) ||
      item.tenant.toLowerCase().includes(query) ||
      item.property.toLowerCase().includes(query) ||
      item.unit.toLowerCase().includes(query)
    );
    renderRows(filtered);
  });

  renderRows(invoiceData);
});