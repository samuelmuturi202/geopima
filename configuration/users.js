// users.js
document.addEventListener('DOMContentLoaded', async () => {
  const usersGrid = document.querySelector('.users-grid');
  const modal = document.getElementById('createUserModal');
  const openAddUserBtn = document.getElementById('openAddUserModal');
  const closeUserModalBtn = document.getElementById('closeUserModal');
  const cancelUserModalBtn = document.getElementById('cancelUserModal');
  const createUserForm = document.getElementById('createUserForm');
  const roleSelect = document.getElementById('userRoles');

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
      const users = Array.isArray(response) ? response : (response.results || []);
      renderUserCards(users);
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
          <div class="status-badge active-status">User is active</div>
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
        const card = e.target.closest('.user-card');
        const userName = card.querySelector('.user-name-title').textContent;
        alert(`Opening details for user: ${userName} (ID: ${userId})`);
      });
    });
  }

  loadUsers();
  loadRoleOptions();
});