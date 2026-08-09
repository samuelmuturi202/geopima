document.addEventListener('DOMContentLoaded', () => {

  // DOM Elements
  const modal = document.getElementById('template-modal');
  const openModalBtn = document.getElementById('btn-new-template');
  const closeModalBtn = document.getElementById('modal-close');
  const cancelBtn = document.getElementById('btn-cancel');
  const templateForm = document.getElementById('template-form');
  const tbody = document.getElementById('templates-tbody');

  // Local state array for templates
  let templates = [];

  // Open Modal
  openModalBtn.addEventListener('click', () => {
    modal.classList.add('active');
  });

  // Close Modal
  function closeModal() {
    modal.classList.remove('active');
    templateForm.reset();
  }

  closeModalBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Handle Form Submission & Dynamic Table Update
  templateForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('template-name').value.trim();
    const type = document.getElementById('template-type').value;
    const isDefault = document.getElementById('template-default').checked;
    const isActive = document.getElementById('template-active').checked;

    if (!name || !type) return;

    // Add new template object
    const newTemplate = {
      id: Date.now(),
      name,
      type,
      isDefault,
      isActive
    };

    templates.push(newTemplate);
    renderTemplates();
    closeModal();
  });

  // Render Table Rows
  function renderTemplates() {
    if (templates.length === 0) {
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
        <td>${escapeHtml(tpl.type)}</td>
        <td>${tpl.isDefault ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-secondary">No</span>'}</td>
        <td>${tpl.isActive ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-secondary">Inactive</span>'}</td>
        <td style="text-align: center;">
          <div class="action-btn-group">
            <button class="btn-action-icon" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="btn-action-icon delete" onclick="deleteTemplate(${tpl.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Delete Template Handler
  window.deleteTemplate = function(id) {
    templates = templates.filter(tpl => tpl.id !== id);
    renderTemplates();
  };

  // Helper for HTML escaping
  function escapeHtml(str) {
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

});