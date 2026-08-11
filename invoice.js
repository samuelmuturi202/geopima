document.addEventListener('DOMContentLoaded', () => {

  // 1. PDF Download / Browser Print Command
  const downloadPdfBtn = document.getElementById('btn-download-pdf');
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // 2. Send Invoice Link Action Trigger
  const sendLinkBtn = document.getElementById('btn-send-link');
  if (sendLinkBtn) {
    sendLinkBtn.addEventListener('click', () => {
      alert('Invoice live view link sent via SMS to tenant (254798967207).');
    });
  }

  // 3. Modal Controllers
  const modalPayment = document.getElementById('modal-payment');
  const addPaymentBtn = document.getElementById('btn-add-payment');
  const closeModalBtns = document.querySelectorAll('.close-modal');

  if (addPaymentBtn && modalPayment) {
    addPaymentBtn.addEventListener('click', () => {
      modalPayment.classList.add('active');
    });
  }

  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (modalPayment) modalPayment.classList.remove('active');
    });
  });

  // 4. Record Payment Dynamic Form Handling
  const formAddPayment = document.getElementById('form-add-payment');
  if (formAddPayment) {
    formAddPayment.addEventListener('submit', (e) => {
      e.preventDefault();

      const payRef = document.getElementById('pay-ref').value;
      const payChannel = document.getElementById('pay-channel').value;
      const payAmount = parseFloat(document.getElementById('pay-amount').value);

      if (!payAmount || payAmount <= 0) {
        alert('Please enter a valid payment amount.');
        return;
      }

      // Dynamically Append Row to Payment Details Table
      const paymentBody = document.getElementById('payment-details-body');
      const rowCount = paymentBody.children.length + 1;
      const todayDate = new Date().toISOString().split('T')[0];

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${rowCount}</td>
        <td><a href="#" class="receipt-link">${payRef}</a></td>
        <td>${payChannel}<br><small class="text-muted">REF#: ${payRef}</small></td>
        <td>${payChannel}</td>
        <td>${todayDate}</td>
        <td>Manual</td>
        <td class="text-right">${payAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
      `;

      paymentBody.appendChild(tr);

      // Recalculate Financial Balances
      recalculateInvoiceTotals(payAmount);

      // Close modal and reset form
      modalPayment.classList.remove('active');
      formAddPayment.reset();
      alert('Payment successfully recorded and allocated.');
    });
  }

  // Helper Function: Recalculates Subtotal, Less Paid, and Net Balance
  function recalculateInvoiceTotals(additionalPayment = 0) {
    const subtotalEl = document.getElementById('summary-subtotal');
    const lessPaidEl = document.getElementById('summary-lesspaid');
    const balanceEl = document.getElementById('summary-balance');
    const totalPaidFooter = document.getElementById('total-paid-footer');

    let currentSubtotal = parseFloat(subtotalEl.textContent.replace(/,/g, ''));
    let currentLessPaid = parseFloat(lessPaidEl.textContent.replace(/,/g, ''));

    currentLessPaid += additionalPayment;
    const newBalance = currentSubtotal - currentLessPaid;

    lessPaidEl.textContent = currentLessPaid.toLocaleString('en-US', {minimumFractionDigits: 2});
    totalPaidFooter.textContent = currentLessPaid.toLocaleString('en-US', {minimumFractionDigits: 2});
    balanceEl.textContent = newBalance.toLocaleString('en-US', {minimumFractionDigits: 2});

    if (newBalance < 0) {
      balanceEl.className = 'text-credit';
    } else {
      balanceEl.className = '';
    }
  }

});