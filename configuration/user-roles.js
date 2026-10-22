// user-roles.js
document.addEventListener('DOMContentLoaded', async () => {
  const tbody = document.querySelector('.roles-table tbody');
  const searchInput = document.getElementById('rolesSearch');
  const tableInfoSummary = document.getElementById('tableInfoSummary');
  const newRoleBtn = document.getElementById('newRoleBtn');
  const permissionsBtn = document.getElementById('permissionsBtn');

  // Modal elements (Optional: used if your permissions matrix is inside an inline modal)
  const permModal = document.getElementById('permissionsModal'); 
  const closePermModalBtn = document.getElementById('closePermModal');
  const permissionsForm = document.getElementById('permissionsForm');
  const permissionsContainer = document.getElementById('permissionsContainer');
  const modalTitle = document.getElementById('pageTitle') || document.getElementById('permModalTitle');

  let allRoles = [];
  let currentRoleId = null;

  const modules = [
    'EMAIL', 'EXPENSE', 'EXPORTS', 'FEE', 'LANDLORD', 
    'MESSAGE', 'PAYMENT', 'PROPERTY', 'REPORTS', 
    'SETTINGS', 'TENANT', 'UNIT', 'USER', 'VOTEHEAD'
  ];

  const actions = ['access', 'create', 'update', 'delete', 'restore', 'destroy'];

  // 1. Load all roles into the table
  async function loadRoles() {
    try {
      const response = await fetchAPI('/user-roles/');
      
      if (Array.isArray(response)) {
        allRoles = response;
      } else if (response && Array.isArray(response.results)) {
        allRoles = response.results;
      } else {
        allRoles = [];
      }

      renderRolesTable(allRoles);
    } catch (error) {
      console.error('Failed to load user roles:', error);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #dc3545; padding: 20px;">Failed to load roles from server.</td></tr>`;
      }
    }
  }

  // 2. Render the roles table
  function renderRolesTable(roles) {
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!roles || roles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">No user roles found.</td></tr>`;
      if (tableInfoSummary) tableInfoSummary.textContent = `Showing 0 to 0 of 0 entries`;
      return;
    }

    roles.forEach((role, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="col-num">${index + 1}</td>
        <td class="role-name-text">${escapeHtml(role.name)}</td>
        <td class="col-center"><button class="btn-action btn-set-permissions" data-id="${role.id}" data-name="${escapeHtml(role.name)}">set permissions</button></td>
        <td class="col-center"><button class="btn-action btn-edit" data-id="${role.id}">edit</button></td>
        <td class="col-center"><button class="btn-action btn-delete" data-id="${role.id}">delete</button></td>
      `;
      tbody.appendChild(row);
    });

    if (tableInfoSummary) {
      tableInfoSummary.textContent = `Showing 1 to ${roles.length} of ${roles.length} entries`;
    }

    attachRoleListeners();
  }

  // 3. Attach click listeners to table action buttons
  function attachRoleListeners() {
    // Delete role handler
    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        const row = e.target.closest('tr');
        const roleName = row.querySelector('.role-name-text').textContent;

        if (confirm(`Are you sure you want to delete role: "${roleName}"?`)) {
          try {
            await fetchAPI(`/user-roles/${id}/`, { method: 'DELETE' });
            loadRoles();
          } catch (err) {
            alert('Failed to delete role: ' + (err.message || 'Server error'));
          }
        }
      });
    });

    // Set Permissions button handler
    document.querySelectorAll('.btn-set-permissions').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        const roleName = e.target.getAttribute('data-name');

        // Check if an inline modal exists on this page. If yes, open it. 
        // If not, redirect seamlessly to the separate permissions page.
        if (permModal && permissionsContainer) {
          currentRoleId = id;
          if (modalTitle) modalTitle.textContent = `${roleName.toUpperCase()} PERMISSIONS`;

          let assignedPermissions = [];
          try {
            const roleData = await fetchAPI(`/user-roles/${currentRoleId}/`);
            if (roleData && Array.isArray(roleData.permissions)) {
              assignedPermissions = roleData.permissions;
            }
          } catch (err) {
            console.error('Failed to fetch role permissions:', err);
          }

          renderPermissionMatrix(assignedPermissions);
          permModal.style.display = 'flex';
        } else {
          // Fallback to separate page redirection
          window.location.href = `role-permissions.html?id=${id}&name=${encodeURIComponent(roleName)}`;
        }
      });
    });

    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        alert(`Open edit modal for Role ID: ${id}`);
      });
    });
  }

  // 4. Render permission checkboxes inside the inline modal matrix
  function renderPermissionMatrix(assignedPermissions) {
    if (!permissionsContainer) return;
    permissionsContainer.innerHTML = '';

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
      permissionsContainer.appendChild(section);
    });
  }

  // 5. Save permissions via PATCH when inline modal form is submitted
  if (permissionsForm) {
    permissionsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentRoleId) return;

      const checkboxes = permissionsForm.querySelectorAll('input[name="permissions"]:checked');
      const selectedPermissions = Array.from(checkboxes).map(cb => cb.value);

      try {
        await fetchAPI(`/user-roles/${currentRoleId}/`, {
          method: 'PATCH',
          body: JSON.stringify({ permissions: selectedPermissions })
        });
        alert('Role permissions saved successfully to backend!');
        
        if (permModal) permModal.style.display = 'none';
        loadRoles();
      } catch (error) {
        console.error('Failed to update permissions:', error);
        alert('Failed to save permissions to server.');
      }
    });
  }

  if (closePermModalBtn && permModal) {
    closePermModalBtn.addEventListener('click', () => {
      permModal.style.display = 'none';
    });
  }

  if (newRoleBtn) {
    newRoleBtn.addEventListener('click', () => {
      const roleName = prompt('Enter new role name:');
      if (roleName && roleName.trim() !== '') {
        createNewRole(roleName.trim());
      }
    });
  }

  async function createNewRole(name) {
    try {
      await fetchAPI('/user-roles/', {
        method: 'POST',
        body: JSON.stringify({ name: name, permissions: [] })
      });
      alert('Role created successfully!');
      loadRoles();
    } catch (error) {
      console.error('Error creating role:', error);
      alert('Failed to save role. Please try again.');
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = allRoles.filter(role => role.name.toLowerCase().includes(term));
      renderRolesTable(filtered);
    });
  }

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

  loadRoles();
});