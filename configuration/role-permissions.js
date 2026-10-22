// role-permissions.js
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roleId = urlParams.get('id');
  const roleName = urlParams.get('name') || 'Role';

  const pageTitle = document.getElementById('pageTitle');
  const breadcrumbRole = document.getElementById('breadcrumbRole');
  const container = document.getElementById('permissionsContainer');

  if (pageTitle) pageTitle.textContent = `${roleName} PERMISSIONS`;
  if (breadcrumbRole) breadcrumbRole.textContent = `${roleName.toLowerCase()} permissions`;

  const modules = [
    'EMAIL', 'EXPENSE', 'EXPORTS', 'FEE', 'LANDLORD', 
    'MESSAGE', 'PAYMENT', 'PROPERTY', 'REPORTS', 
    'SETTINGS', 'TENANT', 'UNIT', 'USER', 'VOTEHEAD'
  ];

  const actions = ['access', 'create', 'update', 'delete', 'restore', 'destroy'];

  let assignedPermissions = [];

  // Fetch existing permissions for this role if API supports it
  if (roleId) {
    try {
      const response = await fetchAPI(`/user-roles/${roleId}/`);
      if (response && response.permissions) {
        assignedPermissions = response.permissions; // Expected array of permission strings or objects
      }
    } catch (err) {
      console.warn('Could not fetch role permissions, rendering default matrix:', err);
    }
  }

  // Render permission categories
  if (container) {
    container.innerHTML = '';
    modules.forEach(mod => {
      const section = document.createElement('div');
      section.className = 'permission-section';

      let checkboxesHtml = '';
      actions.forEach(action => {
        const permKey = `${mod.toLowerCase()}_${action}`;
        const isChecked = assignedPermissions.includes(permKey) ? 'checked' : '';
        checkboxesHtml += `
          <label class="checkbox-item">
            <input type="checkbox" name="permissions" value="${permKey}" ${isChecked}> ${action}
          </label>
        `;
      });

      section.innerHTML = `
        <div class="permission-section-header">
          <i class="fa-solid fa-caret-down"></i> ${mod} PERMISSIONS
        </div>
        <div class="permission-checkboxes-grid">
          ${checkboxesHtml}
        </div>
      `;
      container.appendChild(section);
    });
  }

  // Handle Form Submission
  const form = document.getElementById('permissionsForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const checkboxes = form.querySelectorAll('input[name="permissions"]:checked');
      const selectedPermissions = Array.from(checkboxes).map(cb => cb.value);

      try {
        if (roleId) {
          await fetchAPI(`/user-roles/${roleId}/`, {
            method: 'PATCH',
            body: JSON.stringify({ permissions: selectedPermissions })
          });
        }
        alert('Permissions updated successfully!');
        window.location.href = 'user-roles.html';
      } catch (error) {
        console.error('Failed to update permissions:', error);
        alert('Failed to save permissions. Please try again.');
      }
    });
  }
});