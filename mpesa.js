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
      alert('Downloading MPESA Paybill report as Excel (.xlsx)...');
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      exportDropdown.classList.remove('active');
      alert('Downloading MPESA Paybill report as PDF (.pdf)...');
    });
  }

  // 2. Transactions Dataset
  const mpesaPayments = [
    { id: 1, dateTime: "08-08-2026 07:31:02am", transId: "UH8EB2EVQT", accountNo: "0758887219", tenant: "FRANCIS SALANO", property: "HARRISON PLOT", unit: "H5", payer: "FRANCIS", amount: "2,000.00", status: "successful" },
    { id: 2, dateTime: "08-08-2026 07:10:18am", transId: "UH8QT24XDK", accountNo: "0741689876", tenant: "JOSEPH GICHANA", property: "AGNES NJAMBI", unit: "H18", payer: "JOSEPH", amount: "2,600.00", status: "successful" },
    { id: 3, dateTime: "08-08-2026 06:36:00am", transId: "UH8GA2CFLF", accountNo: "254791578731", tenant: "ROBERT MWATUA", property: "TERESIA WANGECHI", unit: "A4", payer: "ROBERT", amount: "9,200.00", status: "successful" },
    { id: 4, dateTime: "08-08-2026 03:20:18am", transId: "UH85P2JGYH", accountNo: "0704343210", tenant: "JOSPHAT", property: "NANCY KABIRIA PLOT", unit: "B18", payer: "JOSPHAT", amount: "5,000.00", status: "successful" },
    { id: 5, dateTime: "08-08-2026 02:34:25am", transId: "UH81F2B5L3", accountNo: "0748117916", tenant: "MERCY", property: "DOROTHY", unit: "B15", payer: "MERCY", amount: "4,000.00", status: "successful" },
    { id: 6, dateTime: "08-08-2026 01:03:37am", transId: "UH8EZ2GS63", accountNo: "0705876612", tenant: "JUSTUS OMARI CHABAYA", property: "ALICE PLOT", unit: "H2", payer: "JUSTUS", amount: "4,000.00", status: "successful" },
    { id: 7, dateTime: "07-08-2026 23:51:17pm", transId: "UH7IG27E2P", accountNo: "0727717648", tenant: "JOHN", property: "SIMON NDUNGU", unit: "H21", payer: "JOHN", amount: "500.00", status: "successful" },
    { id: 8, dateTime: "07-08-2026 22:44:00pm", transId: "UH7FV2HFE8", accountNo: "0710906802", tenant: "COLLINS", property: "ONDUKO PLOT", unit: "B16", payer: "COLLINS", amount: "500.00", status: "successful" },
    { id: 9, dateTime: "07-08-2026 22:25:32pm", transId: "UH77T24IPQ", accountNo: "0794121289", tenant: "LUCY NDUTA", property: "MONICAH PLOT", unit: "S10", payer: "LUCY", amount: "500.00", status: "successful" },
    { id: 10, dateTime: "07-08-2026 22:18:46pm", transId: "UH77T24H5U", accountNo: "0794121289", tenant: "LUCY NDUTA", property: "MONICAH PLOT", unit: "S10", payer: "LUCY", amount: "1,000.00", status: "successful" },
    { id: 11, dateTime: "07-08-2026 22:18:10pm", transId: "UH7R822YK8", accountNo: "0700232697JOSEHSE13", tenant: "", property: "", unit: "", payer: "JOSEPH", amount: "4,200.00", status: "unsuccessful" },
    { id: 12, dateTime: "07-08-2026 22:11:16pm", transId: "UH7JS1ZJ95", accountNo: "0792361151", tenant: "JASON", property: "MONICAH PLOT", unit: "B3", payer: "JASON", amount: "11,750.00", status: "successful" }
  ];

  // 3. Render Table Records
  const tableBody = document.getElementById('mpesa-table-body');

  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    data.forEach(item => {
      const row = document.createElement('tr');
      const badgeClass = item.status === 'successful' ? 'badge-successful' : 'badge-unsuccessful';

      row.innerHTML = `
        <td>${item.id}</td>
        <td>${item.dateTime}</td>
        <td><a href="#" class="trans-link">${item.transId}</a></td>
        <td>${item.accountNo}</td>
        <td>${item.tenant}</td>
        <td>${item.property}</td>
        <td>${item.unit}</td>
        <td>${item.payer}</td>
        <td><strong>KES ${item.amount}</strong></td>
        <td><span class="badge ${badgeClass}">${item.status}</span></td>
      `;
      tableBody.appendChild(row);
    });
  }

  renderTable(mpesaPayments);

  // 4. Action Button Event Listeners
  const confirmBtn = document.getElementById('confirm-multiple-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      alert('Opening batch transaction verification modal...');
    });
  }

});