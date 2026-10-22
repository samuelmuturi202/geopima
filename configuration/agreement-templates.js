// agreement-templates.js
document.addEventListener('DOMContentLoaded', async () => {
  const modal = document.getElementById('template-modal');
  const openModalBtn = document.getElementById('btn-new-template');
  const closeModalBtn = document.getElementById('modal-close');
  const cancelBtn = document.getElementById('btn-cancel');
  const templateForm = document.getElementById('template-form');
  const tbody = document.getElementById('templates-tbody');

  async function loadTemplates() {
    try {
      const templates = await fetchAPI('/agreement-templates/');
      renderTemplates(templates);
    } catch (error) {
      console.error('Failed to load agreement templates:', error);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-message" style="color: red;">Error loading templates from server.</td></tr>`;
      }
    }
  }

  if (openModalBtn) {
    openModalBtn.addEventListener('click', () => {
      if (modal) modal.classList.add('active');
    });
  }

  function closeModal() {
    if (modal) modal.classList.remove('active');
    if (templateForm) templateForm.reset();
  }

  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  if (templateForm) {
    templateForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('template-name').value.trim();
      const agreement_type = document.getElementById('template-type').value;
      const is_default = document.getElementById('template-default').checked;
      const is_active = document.getElementById('template-active').checked;
      const contentElem = document.getElementById('template-content');
      const content = contentElem ? contentElem.value : '';

      if (!name || !agreement_type) return;

      const newTemplate = {
        name,
        agreement_type,
        is_default,
        is_active,
        content
      };

      try {
        await fetchAPI('/agreement-templates/', {
          method: 'POST',
          body: newTemplate
        });
        loadTemplates();
        closeModal();
      } catch (err) {
        alert('Failed to create agreement template: ' + err.message);
      }
    });
  }

  function renderTemplates(templates) {
    if (!tbody) return;

    if (!templates || templates.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="5" class="empty-message">
            No agreement templates yet. Create one to get started.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = templates.map(tpl => `
      <tr>
        <td>${escapeHtml(tpl.name)}</td>
        <td>${escapeHtml(tpl.agreement_type)}</td>
        <td>${tpl.is_default ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-secondary">No</span>'}</td>
        <td>${tpl.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-secondary">Inactive</span>'}</td>
        <td style="text-align: center;">
          <div class="action-btn-group">
            <button class="btn-action-icon" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="btn-action-icon delete" onclick="deleteTemplate(${tpl.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  window.deleteTemplate = async function(id) {
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        await fetchAPI(`/agreement-templates/${id}/`, { method: 'DELETE' });
        loadTemplates();
      } catch (err) {
        alert('Failed to delete template: ' + err.message);
      }
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }

  loadTemplates();
});