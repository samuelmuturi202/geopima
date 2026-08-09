document.addEventListener('DOMContentLoaded', () => {

  // Mock dataset for live template preview rendering
  const mockData = {
    '{tenant}': 'John Smith',
    '{balance}': '10,500.00',
    '{paid}': '3,500.00',
    '{tnt}': 'W1234',
    '{paybill}': '123456',
    '{agency}': 'Pemwa Agency',
    '{month}': 'AUGUST-2026',
    '{unit}': 'B7',
    '{receiptno}': 'RC1987782',
    '{reference}': 'REF10023',
    '{date}': '09-08-2026',
    '{discount}': '3,000'
  };

  // Bind input listeners to all template cards for live real-time preview updating
  const cards = document.querySelectorAll('.template-card');

  cards.forEach(card => {
    const inputArea = card.querySelector('.template-input');
    const previewArea = card.querySelector('.template-preview');
    const saveBtn = card.querySelector('.btn-save');

    function updatePreview() {
      let text = inputArea.value;
      
      Object.keys(mockData).forEach(key => {
        const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
        text = text.replace(regex, mockData[key]);
      });

      previewArea.value = text;
    }

    if (inputArea && previewArea) {
      inputArea.addEventListener('input', updatePreview);
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        alert('Template changes saved successfully!');
      });
    }
  });

});