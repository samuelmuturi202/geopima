// collection-banks.js
document.addEventListener('DOMContentLoaded', async () => {
  const tableBody = document.querySelector('.banks-table tbody');
  const searchInput = document.getElementById('banksSearch');

  async function loadPaymentBanks() {
    try {
      const banks = await fetchAPI('/payment-banks/');
      renderTable(banks);
    } catch (error) {
      console.error('Failed to load payment banks:', error);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #e53e3e;">Failed to load data from server.</td></tr>`;
      }
    }
  }

  function renderTable(banks) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!banks || banks.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No payment banks found.</td></tr>`;
      return;
    }

    banks.forEach(bank => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${bank.short_name || ''}</td>
        <td>${bank.long_name || ''}</td>
        <td>${bank.branch || ''}</td>
        <td>${bank.acc_name || ''}</td>
        <td>${bank.business_no || ''}</td>
        <td>${bank.acc_number || ''}</td>
        <td class="col-center"><span class="badge-status ${bank.is_active ? 'active' : 'inactive'}">${bank.is_active ? 'active' : 'inactive'}</span></td>
        <td class="col-center"><i class="fa-solid ${bank.on_invoice ? 'fa-circle-check icon-on-invoice-yes' : 'fa-circle-xmark icon-on-invoice-no'}"></i></td>
        <td class="col-center">
          <a href="#" class="action-link link-edit" data-id="${bank.id}">edit</a> | 
          <a href="#" class="action-link link-delete" data-id="${bank.id}">delete</a>
        </td>
      `;
      tableBody.appendChild(row);
    });

    attachActionListeners();
  }

  function attachActionListeners() {
    document.querySelectorAll('.link-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const bankId = e.target.getAttribute('data-id');
        const bankName = e.target.closest('tr').children[0].textContent;

        if (confirm(`Are you sure you want to delete the payment bank: "${bankName}"?`)) {
          try {
            await fetchAPI(`/payment-banks/${bankId}/`, { method: 'DELETE' });
            loadPaymentBanks();
          } catch (err) {
            alert('Error deleting bank: ' + err.message);
          }
        }
      });
    });

    document.querySelectorAll('.link-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const bankId = e.target.getAttribute('data-id');
        alert(`Open Edit Modal for Bank ID: ${bankId}`);
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener('keyup', (e) => {
      const term = e.target.value.toLowerCase();
      const rows = tableBody.querySelectorAll('tr');
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }

  const newBankBtn = document.querySelector('.btn-new-bank');
  if (newBankBtn) {
    newBankBtn.addEventListener('click', () => {
      alert('Open New Bank Modal / Form');
    });
  }

  loadPaymentBanks();
});