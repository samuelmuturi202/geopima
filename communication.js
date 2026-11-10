document.addEventListener('DOMContentLoaded', () => {
  const draftList = document.getElementById('draft-list');
  const serviceStatus = document.getElementById('draft-service-status');
  const feedback = document.getElementById('draft-feedback');
  const countLabel = document.getElementById('draft-count');
  const pageLabel = document.getElementById('page-label');
  const statusFilter = document.getElementById('status-filter');
  const recipientFilter = document.getElementById('recipient-filter');
  const generateButton = document.getElementById('generate-drafts');
  const refreshButton = document.getElementById('refresh-drafts');
  const previousButton = document.getElementById('previous-page');
  const nextButton = document.getElementById('next-page');
  let currentPage = 1;

  function setFeedback(message, isError = false) {
    feedback.textContent = message;
    feedback.classList.toggle('is-error', isError);
  }

  function setServiceStatus(text, state) {
    serviceStatus.textContent = text;
    serviceStatus.className = `backend-status status-${state}`;
  }

  function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text || '';
    return element;
  }

  function labelForReminder(type) {
    const labels = {
      rent_due: 'Rent due soon',
      rent_overdue: 'Overdue rent',
      landlord_monthly: 'Monthly landlord update'
    };
    return labels[type] || 'SMS draft';
  }

  function labelForStatus(status) {
    const labels = {
      pending: 'Awaiting approval',
      approved: 'Approved',
      sent: 'Sent',
      failed: 'Provider rejected',
      unknown: 'Delivery uncertain'
    };
    return labels[status] || status;
  }

  async function loadServiceStatus() {
    try {
      const result = await fetchAPI('/billing/communication-drafts/service-status/');
      setServiceStatus(
        result.message,
        result.ready ? 'online' : 'error'
      );
    } catch (error) {
      console.error('Failed to check SMS readiness:', error);
      setServiceStatus('Could not verify SMS readiness. Check the service connection.', 'error');
    }
  }

  function renderDraft(draft) {
    const card = document.createElement('article');
    card.className = 'draft-card';

    const heading = document.createElement('div');
    heading.className = 'draft-card-heading';
    const title = document.createElement('h4');
    title.textContent = `${draft.recipient_name} · ${draft.recipient_type}`;
    const status = createTextElement(
      'span',
      `draft-status status-${draft.status}`,
      labelForStatus(draft.status)
    );
    heading.append(title, status);
    card.appendChild(heading);

    card.appendChild(createTextElement(
      'p',
      'draft-type',
      `${labelForReminder(draft.reminder_type)} · ${draft.phone_number}`
    ));

    const details = [];
    if (draft.property_name) details.push(draft.property_name);
    if (draft.unit_name) details.push(`Unit ${draft.unit_name}`);
    if (draft.invoice_number) details.push(`Invoice ${draft.invoice_number}`);
    if (draft.period) {
      details.push(`Period ${new Date(`${draft.period}T00:00:00`).toLocaleDateString()}`);
    }
    if (details.length) {
      card.appendChild(createTextElement('p', 'draft-details', details.join(' · ')));
    }

    card.appendChild(createTextElement('p', 'draft-message', draft.message));

    if (draft.status === 'pending') {
      const actions = document.createElement('div');
      actions.className = 'draft-card-actions';
      const approveButton = createTextElement('button', 'draft-button', 'Approve draft');
      approveButton.type = 'button';
      approveButton.addEventListener('click', async () => {
        approveButton.disabled = true;
        try {
          await fetchAPI(`/billing/communication-drafts/${draft.id}/approve/`, {
            method: 'POST'
          });
          setFeedback('Draft approved. No SMS was sent.');
          await loadDrafts(currentPage);
        } catch (error) {
          setFeedback(`Could not approve this draft: ${error.message}`, true);
          approveButton.disabled = false;
        }
      });
      actions.appendChild(approveButton);
      card.appendChild(actions);
    }

    if (draft.status === 'approved' || draft.status === 'failed') {
      const actions = document.createElement('div');
      actions.className = 'draft-card-actions';
      const sendButton = createTextElement(
        'button',
        'draft-button',
        draft.status === 'failed' ? 'Retry rejected SMS' : 'Send SMS'
      );
      sendButton.type = 'button';
      sendButton.addEventListener('click', async () => {
        const confirmed = window.confirm(
          `Send this SMS to ${draft.recipient_name} (${draft.phone_number})?\n\n${draft.message}`
        );
        if (!confirmed) return;

        sendButton.disabled = true;
        try {
          await fetchAPI(`/billing/communication-drafts/${draft.id}/send/`, {
            method: 'POST'
          });
          setFeedback(`SMS sent to ${draft.recipient_name}.`);
          await loadDrafts(currentPage);
        } catch (error) {
          setFeedback(`SMS was not confirmed as sent: ${error.message}`, true);
          await loadDrafts(currentPage);
        }
      });
      actions.appendChild(sendButton);
      card.appendChild(actions);
    }

    if (draft.status === 'unknown') {
      card.appendChild(createTextElement(
        'p',
        'draft-details',
        'Do not retry automatically. Check the Celcom dashboard to confirm whether it was accepted.'
      ));
    }
    if (draft.provider_message_id) {
      card.appendChild(createTextElement(
        'p',
        'draft-details',
        `Celcom message ID: ${draft.provider_message_id}`
      ));
    }

    return card;
  }

  async function loadDrafts(page = 1) {
    currentPage = page;
    draftList.replaceChildren(createTextElement('p', 'empty-drafts', 'Loading message drafts...'));
    const params = new URLSearchParams({ page: String(page) });
    if (statusFilter.value) params.set('status', statusFilter.value);
    if (recipientFilter.value) params.set('recipient_type', recipientFilter.value);

    try {
      const response = await fetchAPI(`/billing/communication-drafts/?${params}`);
      const drafts = Array.isArray(response) ? response : (response.results || []);
      draftList.replaceChildren();
      await loadServiceStatus();

      if (!drafts.length) {
        draftList.appendChild(createTextElement(
          'p',
          'empty-drafts',
          'No drafts match these filters. Generate today’s drafts or adjust the filters.'
        ));
      } else {
        drafts.forEach(draft => draftList.appendChild(renderDraft(draft)));
      }

      const total = response.count ?? drafts.length;
      countLabel.textContent = `${total} draft${total === 1 ? '' : 's'} in the backend queue`;
      pageLabel.textContent = drafts.length ? `Page ${page}` : '';
      previousButton.disabled = page <= 1;
      nextButton.disabled = !response.next;
    } catch (error) {
      console.error('Failed to load communication drafts:', error);
      setServiceStatus('Communication service unavailable', 'error');
      draftList.replaceChildren(createTextElement(
        'p',
        'empty-drafts is-error',
        `Could not load drafts: ${error.message}`
      ));
      countLabel.textContent = '';
      pageLabel.textContent = '';
      previousButton.disabled = true;
      nextButton.disabled = true;
    }
  }

  generateButton.addEventListener('click', async () => {
    generateButton.disabled = true;
    setFeedback('Generating drafts from current invoices and landlord collections...');
    try {
      const result = await fetchAPI('/billing/communication-drafts/generate/', {
        method: 'POST'
      });
      const skipped = result.skipped_no_phone
        ? ` ${result.skipped_no_phone} recipient(s) had no phone number and were skipped.`
        : '';
      const updated = result.updated
        ? ` ${result.updated} pending draft(s) refreshed from the latest Configuration templates.`
        : '';
      const noDrafts = result.created === 0 && result.updated === 0
        ? ' No invoices were due for a reminder and no landlord summary was available for this period. Check invoice dates, balances, active recipients and phone numbers.'
        : '';
      setFeedback(
        `${result.created} new draft(s) generated.${updated}${noDrafts} No SMS was sent.${skipped}`
      );
      await loadDrafts(1);
    } catch (error) {
      setFeedback(`Could not generate drafts: ${error.message}`, true);
    } finally {
      generateButton.disabled = false;
    }
  });

  refreshButton.addEventListener('click', () => loadDrafts(currentPage));
  statusFilter.addEventListener('change', () => loadDrafts(1));
  recipientFilter.addEventListener('change', () => loadDrafts(1));
  previousButton.addEventListener('click', () => loadDrafts(currentPage - 1));
  nextButton.addEventListener('click', () => loadDrafts(currentPage + 1));

  const draftsPanel = document.querySelector('.drafts-panel');
  draftsPanel.addEventListener('toggle', () => {
    if (draftsPanel.open) loadDrafts(1);
  });

  document.querySelectorAll('.sms-btn').forEach(button => {
    button.addEventListener('click', () => {
      const selectedRecipient = button.dataset.recipient || '';
      const wasOpen = draftsPanel.open;
      recipientFilter.value = selectedRecipient;
      draftsPanel.open = true;
      setFeedback(
        'Bulk SMS sending and recipient selection are not connected to the backend. ' +
        'The queue below shows automated drafts only; no message was sent.'
      );
      draftsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (wasOpen) loadDrafts(1);
    });
  });

  setServiceStatus('Checking communication service...', 'checking');
  loadDrafts();
});
