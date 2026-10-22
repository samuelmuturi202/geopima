// sms-templates.js
document.addEventListener('DOMContentLoaded', async () => {
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

  async function loadTemplates() {
    try {
      const templates = await fetchAPI('/sms-templates/');
      templates.forEach(t => {
        const card = document.querySelector(`.template-card[data-category="${t.category}"]`) || document.querySelector(`textarea[data-category="${t.category}"]`)?.closest('.template-card');
        if (card) {
          const inputArea = card.querySelector('.template-input');
          const previewArea = card.querySelector('.template-preview');
          if (inputArea) {
            inputArea.value = t.template_text || '';
            updatePreview(inputArea, previewArea);
          }
        }
      });
    } catch (error) {
      console.error('Failed to load SMS templates:', error);
    }
  }

  function updatePreview(inputArea, previewArea) {
    if (!inputArea || !previewArea) return;
    let text = inputArea.value;
    
    Object.keys(mockData).forEach(key => {
      const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
      text = text.replace(regex, mockData[key]);
    });

    previewArea.value = text;
  }

  const cards = document.querySelectorAll('.template-card');

  cards.forEach(card => {
    const inputArea = card.querySelector('.template-input');
    const previewArea = card.querySelector('.template-preview');
    const saveBtn = card.querySelector('.btn-save');
    const category = card.getAttribute('data-category');

    if (inputArea && previewArea) {
      inputArea.addEventListener('input', () => updatePreview(inputArea, previewArea));
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (!category || !inputArea) return;
        
        try {
          await fetchAPI('/sms-templates/bulk-save/', {
            method: 'POST',
            body: [{
              category: category,
              template_text: inputArea.value
            }]
          });
          alert('Template changes saved successfully to backend!');
        } catch (err) {
          alert('Error saving template: ' + err.message);
        }
      });
    }
  });

  loadTemplates();
});