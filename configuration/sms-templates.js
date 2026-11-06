document.addEventListener('DOMContentLoaded', async () => {
  const sampleValues = {
    tenant: 'John Smith',
    balance: '10,500.00',
    paid: '3,500.00',
    tnt: 'W1234',
    paybill: '123456',
    agency: 'Pemwa Agency',
    month: 'AUGUST-2026',
    unit: 'B7',
    receiptno: 'RC1987782',
    reference: 'REF10023',
    date: '09-08-2026',
    discount: '3,000',
    due_date: '05 Nov 2026',
    landlord: 'Amina Landlord',
    expected: '100,000.00',
    collected: '85,000.00',
    outstanding: '15,000.00'
  };
  const serviceStatus = document.getElementById('template-service-status');
  const cards = [...document.querySelectorAll('.template-card[data-category]')];

  function setStatus(message, isError = false) {
    serviceStatus.textContent = message;
    serviceStatus.classList.toggle('is-error', isError);
  }

  function updatePreview(inputArea, previewArea) {
    if (!inputArea || !previewArea) return;
    previewArea.value = inputArea.value.replace(
      /\{([a-zA-Z0-9_]+)\}/g,
      (placeholder, key) => Object.hasOwn(sampleValues, key)
        ? sampleValues[key]
        : placeholder
    );
  }

  function showCardStatus(card, message, isError = false) {
    let status = card.querySelector('.template-save-status');
    if (!status) {
      status = document.createElement('span');
      status.className = 'template-save-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      card.querySelector('.form-actions').prepend(status);
    }
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  cards.forEach(card => {
    const inputArea = card.querySelector('.template-input');
    const previewArea = card.querySelector('.template-preview');
    const saveButton = card.querySelector('.btn-save');
    const category = card.dataset.category;

    inputArea?.addEventListener('input', () => updatePreview(inputArea, previewArea));
    if (!saveButton || !inputArea || !category) return;

    saveButton.addEventListener('click', async () => {
      if (!inputArea.value.trim()) {
        showCardStatus(card, 'Template text cannot be empty.', true);
        return;
      }

      saveButton.disabled = true;
      try {
        await fetchAPI('/sms-templates/bulk-save/', {
          method: 'POST',
          body: [{ category, template_text: inputArea.value }]
        });
        updatePreview(inputArea, previewArea);
        showCardStatus(card, 'Saved. New drafts will use this template.');
        setStatus('Templates are connected to the communication draft service.');
      } catch (error) {
        console.error(`Failed to save ${category} SMS template:`, error);
        showCardStatus(card, `Save failed: ${error.message}`, true);
        setStatus('Could not save this template. Check your access and connection.', true);
      } finally {
        saveButton.disabled = false;
      }
    });
  });

  try {
    const response = await fetchAPI('/sms-templates/');
    const templates = Array.isArray(response) ? response : (response.results || []);
    const templatesByCategory = new Map(templates.map(template => [template.category, template]));

    cards.forEach(card => {
      const savedTemplate = templatesByCategory.get(card.dataset.category);
      const inputArea = card.querySelector('.template-input');
      const previewArea = card.querySelector('.template-preview');
      if (savedTemplate && inputArea) inputArea.value = savedTemplate.template_text;
      updatePreview(inputArea, previewArea);
    });

    setStatus('Templates are connected to the communication draft service.');
  } catch (error) {
    console.error('Failed to load SMS templates:', error);
    setStatus(`Could not load templates: ${error.message}`, true);
    cards.forEach(card => {
      updatePreview(card.querySelector('.template-input'), card.querySelector('.template-preview'));
    });
  }
});
