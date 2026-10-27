// collection-banks.js
document.addEventListener('DOMContentLoaded', async () => {
  const tableBody = document.querySelector('.banks-table tbody');
  const searchInput = document.getElementById('banksSearch');
  const bankModal = document.getElementById('bankModal');
  const btnNewBank = document.getElementById('btnNewBank');
  const closeModal = document.getElementById('closeModal');
  const bankForm = document.getElementById('bankForm');
  const modalTitle = document.getElementById('modalTitle');
  const entriesInfo = document.getElementById('entriesInfo');

  let banksData = [];

  async function loadPaymentBanks() {
    try {
      const response = await fetchAPI('/payment-banks/');
      // Handles both plain arrays and paginated result sets safely
      banksData = Array.isArray(response) ? response : (response.results || []);
      renderTable(banksData);
    } catch (error) {
      console.error('Failed to load payment banks:', error);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #e53e3e;">Failed to load data from server.</td></tr>`;
      }
    }
  }

  function renderTable(banks) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!banks || banks.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center;">No payment banks or channels found.</td></tr>`;
      if (entriesInfo) entriesInfo.textContent = 'Showing 0 entries';
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
        <td class="col-center"><span style="text-transform:uppercase; font-size:0.72rem; font-weight:600; color:#0f4c81;">${bank.bank_type || 'bank'}</span></td>
        <td class="col-center"><span class="badge-status ${bank.is_active ? 'active' : 'inactive'}">${bank.is_active ? 'active' : 'inactive'}</span></td>
        <td class="col-center"><i class="fa-solid ${bank.on_invoice ? 'fa-circle-check icon-on-invoice-yes' : 'fa-circle-xmark icon-on-invoice-no'}"></i></td>
        <td class="col-center">
          <a href="#" class="action-link link-edit" data-id="${bank.id}">edit</a> | 
          <a href="#" class="action-link link-delete" data-id="${bank.id}">delete</a>
        </td>
      `;
      tableBody.appendChild(row);
    });

    if (entriesInfo) {
      entriesInfo.textContent = `Showing 1 to ${banks.length} of ${banks.length} entries`;
    }

    attachActionListeners();
  }

  function attachActionListeners() {
    document.querySelectorAll('.link-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const bankId = e.target.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this payment channel?')) {
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
        const bank = banksData.find(b => b.id == bankId);
        if (bank) {
          openModal(bank);
        }
      });
    });
  }

  function openModal(bank = null) {
    bankModal.style.display = 'flex';
    if (bank) {
      modalTitle.textContent = 'Edit Payment Bank / Channel';
      document.getElementById('bankId').value = bank.id;
      document.getElementById('bankType').value = bank.bank_type || 'bank';
      document.getElementById('shortName').value = bank.short_name || '';
      document.getElementById('longName').value = bank.long_name || '';
      document.getElementById('branch').value = bank.branch || '';
      document.getElementById('accName').value = bank.acc_name || '';
      document.getElementById('businessNo').value = bank.business_no || '';
      document.getElementById('accNumber').value = bank.acc_number || '';
      document.getElementById('isActive').checked = bank.is_active;
      document.getElementById('onInvoice').checked = bank.on_invoice;
    } else {
      modalTitle.textContent = 'Add Payment Bank / Channel';
      bankForm.reset();
      document.getElementById('bankId').value = '';
    }
  }

  if (btnNewBank) {
    btnNewBank.addEventListener('click', () => openModal());
  }

  if (closeModal) {
    closeModal.addEventListener('click', () => {
      bankModal.style.display = 'none';
    });
  }

  if (bankForm) {
    bankForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bankId = document.getElementById('bankId').value;
      const payload = {
        bank_type: document.getElementById('bankType').value,
        short_name: document.getElementById('shortName').value,
        long_name: document.getElementById('longName').value,
        branch: document.getElementById('branch').value,
        acc_name: document.getElementById('accName').value,
        business_no: document.getElementById('businessNo').value,
        acc_number: document.getElementById('accNumber').value,
        is_active: document.getElementById('isActive').checked,
        on_invoice: document.getElementById('onInvoice').checked
      };

      try {
        if (bankId) {
          await fetchAPI(`/payment-banks/${bankId}/`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
        } else {
          await fetchAPI('/payment-banks/', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        }
        bankModal.style.display = 'none';
        loadPaymentBanks();
      } catch (err) {
        alert('Failed to save payment bank: ' + err.message);
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('keyup', (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = banksData.filter(b => 
        Object.values(b).some(val => String(val).toLowerCase().includes(term))
      );
      renderTable(filtered);
    });
  }

  loadPaymentBanks();
});