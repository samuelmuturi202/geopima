// users.js
document.addEventListener('DOMContentLoaded', async () => {
  const usersGrid = document.querySelector('.users-grid');
  const listView = document.getElementById('users-listView');
  const detailView = document.getElementById('users-detailView');
  const backBtn = document.getElementById('backToUsersList');

  const modal = document.getElementById('createUserModal');
  const openAddUserBtn = document.getElementById('openAddUserModal');
  const closeUserModalBtn = document.getElementById('closeUserModal');
  const cancelUserModalBtn = document.getElementById('cancelUserModal');
  const createUserForm = document.getElementById('createUserForm');
  const roleSelect = document.getElementById('userRoles');

  let currentUsersList = [];

  const PERMISSION_MODULES = [
    'EMAIL', 'EXPENSE', 'EXPORTS', 'FEE', 
    'PROPERTY', 'REPORTS', 'SETTINGS', 
    'TENANT', 'UNIT', 'USER', 'VOTEHEAD'
  ];
  const PERMISSION_ACTIONS = ['access', 'create', 'update', 'delete', 'restore', 'destroy'];

  // Load available roles into the dropdown select box
  async function loadRoleOptions() {
    if (!roleSelect) return;
    try {
      const response = await fetchAPI('/user-roles/');
      const roles = Array.isArray(response) ? response : (response.results || []);
      
      roleSelect.innerHTML = '<option value="">Select a role...</option>';
      roles.forEach(role => {
        const option = document.createElement('option');
        option.value = role.id; // Ensure option value is the numeric ID
        option.textContent = role.name;
        roleSelect.appendChild(option);
      });
    } catch (err) {
      console.error('Failed to load role options for dropdown:', err);
    }
  }

  // Open Modal logic
  if (openAddUserBtn && modal) {
    openAddUserBtn.addEventListener('click', () => {
      loadRoleOptions(); // Fetch latest roles when opening modal
      modal.style.display = 'flex';
    });
  }

  // Close Modal logic
  function closeModal() {
    if (modal) {
      modal.style.display = 'none';
      if (createUserForm) createUserForm.reset();
    }
  }

  if (closeUserModalBtn) closeUserModalBtn.addEventListener('click', closeModal);
  if (cancelUserModalBtn) cancelUserModalBtn.addEventListener('click', closeModal);

  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Handle Form Submission
  if (createUserForm) {
    createUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Fixed: Parse role_id into an integer so DRF accepts it as a primary key
      const roleVal = roleSelect ? roleSelect.value : '';
      const parsedRoleId = roleVal ? parseInt(roleVal, 10) : null;

      const payload = {
        full_name: document.getElementById('fullName').value,
        username: document.getElementById('username').value,
        email: document.getElementById('emailAddress').value,
        phone: document.getElementById('phone').value,
        position: document.getElementById('position').value,
        role_id: parsedRoleId,
        password: document.getElementById('password').value
      };

      try {
        await fetchAPI('/users/', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        alert('User created successfully!');
        closeModal();
        loadUsers();
      } catch (error) {
        console.error('Failed to create user:', error);
        alert('Error saving user. Please check your inputs.');
      }
    });
  }

  async function loadUsers() {
    try {
      const response = await fetchAPI('/users/');
      currentUsersList = Array.isArray(response) ? response : (response.results || []);
      renderUserCards(currentUsersList);
    } catch (error) {
      console.error('Failed to load users:', error);
      if (usersGrid) {
        usersGrid.innerHTML = `<p style="padding: 20px; color: #e53e3e;">Failed to load user profiles from server.</p>`;
      }
    }
  }

  function renderUserCards(users) {
    if (!usersGrid) return;
    usersGrid.innerHTML = '';

    if (!users || users.length === 0) {
      usersGrid.innerHTML = `<p style="padding: 20px;">No user profiles available.</p>`;
      return;
    }

    users.forEach(user => {
      const card = document.createElement('div');
      card.className = 'user-card';

      const roleText = user.role || 'super admin';
      const roleClass = roleText.toLowerCase().replace(/\s+/g, '-');
      
      card.innerHTML = `
        <div class="avatar-circle">
          <i class="fa-solid fa-user"></i>
        </div>
        <h3 class="user-name-title">${user.name || user.username || 'System User'}</h3>
        <p class="user-meta">Username: <span class="meta-val">${user.username || 'N/A'}</span></p>
        <p class="user-meta email-meta">${user.email || 'N/A'}</p>
        <p class="user-meta">Phone: <span class="meta-val">${user.user_phone || user.phone || 'N/A'}</span></p>
        <p class="user-meta role-meta">Role(s): <span class="role-badge ${roleClass}">${roleText}</span></p>
        
        <div class="card-actions">
          <div class="status-badge ${user.is_active !== false ? 'active-status' : 'inactive-status'}">
            ${user.is_active !== false ? 'User is active' : 'User is inactive'}
          </div>
          <button class="btn-view-details" data-id="${user.id || ''}">View details</button>
        </div>
      `;
      usersGrid.appendChild(card);
    });

    attachUserListeners();
  }

  function attachUserListeners() {
    const detailButtons = document.querySelectorAll('.btn-view-details');
    detailButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.getAttribute('data-id');
        const selectedUser = currentUsersList.find(u => String(u.id) === String(userId));
        if (selectedUser) {
          showUserDetails(selectedUser);
        } else {
          fetchUserDetailsAndShow(userId);
        }
      });
    });
  }

  async function fetchUserDetailsAndShow(userId) {
    try {
      const user = await fetchAPI(`/users/${userId}/`);
      showUserDetails(user);
    } catch (err) {
      alert("Failed to load user details.");
    }
  }

  function showUserDetails(user) {
    if (!listView || !detailView) return;

    listView.style.display = 'none';
    detailView.style.display = 'block';

    const displayName = user.name || (user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.username);
    
    const pageTitle = document.getElementById('detail-page-title');
    if (pageTitle) pageTitle.textContent = `USERS ${displayName.toUpperCase()}`;
    
    const breadcrumbName = document.getElementById('detail-breadcrumb-name');
    if (breadcrumbName) breadcrumbName.textContent = displayName;

    const fullNameElem = document.getElementById('detail-fullname');
    if (fullNameElem) fullNameElem.textContent = displayName;

    const positionElem = document.getElementById('detail-position');
    if (positionElem) positionElem.textContent = user.user_position || user.position || 'N/A';

    const emailElem = document.getElementById('detail-email');
    if (emailElem) {
      emailElem.textContent = user.email || 'N/A';
      emailElem.href = `mailto:${user.email}`;
    }

    const createdElem = document.getElementById('detail-created');
    if (createdElem) createdElem.textContent = user.date_joined || 'N/A';

    const roleElem = document.getElementById('detail-role');
    if (roleElem) roleElem.textContent = user.role || 'super admin';

    const deleteBtn = document.getElementById('btn-delete-user');
    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        if (confirm(`Are you sure you want to delete user: ${displayName}?`)) {
          try {
            await fetchAPI(`/users/${user.id}/`, { method: 'DELETE' });
            alert('User deleted successfully.');
            detailView.style.display = 'none';
            listView.style.display = 'block';
            loadUsers();
          } catch (err) {
            alert('Failed to delete user.');
          }
        }
      };
    }

    const editBtn = document.getElementById('btn-edit-user');
    if (editBtn) {
      editBtn.onclick = () => {
        alert(`Edit view triggered for ${displayName}`);
      };
    }

    const passBtn = document.getElementById('btn-change-password');
    if (passBtn) {
      passBtn.onclick = () => {
        const newPass = prompt(`Enter new password for ${displayName}:`);
        if (newPass) {
          alert('Password update request sent.');
        }
      };
    }

    const matrixContainer = document.getElementById('permissions-matrix-container');
    if (matrixContainer) {
      matrixContainer.innerHTML = '';

      const userPermissions = user.permissions || [];

      PERMISSION_MODULES.forEach(module => {
        const sectionDiv = document.createElement('div');
        sectionDiv.style.borderBottom = '1px solid #e2e8f0';
        sectionDiv.style.padding = '16px';

        const title = document.createElement('div');
        title.style.fontSize = '12px';
        title.style.fontWeight = '700';
        title.style.color = '#334155';
        title.style.margin = '0 0 12px 0';
        title.style.background = '#f8fafc';
        title.style.padding = '8px 12px';
        title.style.borderRadius = '4px';
        title.style.display = 'flex';
        title.style.alignItems = 'center';
        title.style.gap = '8px';
        title.innerHTML = `<i class="fa-solid fa-caret-down"></i> ${module} PERMISSIONS`;
        sectionDiv.appendChild(title);

        const gridDiv = document.createElement('div');
        gridDiv.style.display = 'grid';
        gridDiv.style.gridTemplateColumns = 'repeat(auto-fill, minmax(130px, 1fr))';
        gridDiv.style.gap = '12px';
        gridDiv.style.paddingLeft = '12px';

        PERMISSION_ACTIONS.forEach(action => {
          const permKey = `${module.toLowerCase()}.${action}`;
          const hasPerm = user.is_superuser || userPermissions.includes(permKey) || userPermissions.includes(action);

          const label = document.createElement('label');
          label.style.display = 'flex';
          label.style.alignItems = 'center';
          label.style.gap = '8px';
          label.style.fontSize = '13px';
          label.style.color = '#475569';
          label.style.cursor = 'default';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = hasPerm;
          checkbox.disabled = true;
          checkbox.style.width = '15px';
          checkbox.style.height = '15px';
          checkbox.style.accentColor = '#2563eb';

          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(action));
          gridDiv.appendChild(label);
        });

        sectionDiv.appendChild(gridDiv);
        matrixContainer.appendChild(sectionDiv);
      });
    }
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      detailView.style.display = 'none';
      listView.style.display = 'block';
    });
  }

  loadUsers();
  loadRoleOptions();
});