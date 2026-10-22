document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const landlordId = urlParams.get('id');

  if (!landlordId) {
    alert('No Landlord ID specified in URL.');
    window.location.href = 'landlords.html';
    return;
  }

  let currentLandlord = null;

  // --- Element Selectors ---
  const statusBadgeBtn = document.getElementById('btn-status-badge');
  const editBtn = document.getElementById('btn-edit-landlord');
  const suspendBtn = document.getElementById('btn-suspend-landlord');
  const deleteBtn = document.getElementById('btn-delete-landlord');
  const addPropertyBtn = document.getElementById('add-property-btn');

  // --- Load Landlord & Associated Properties ---
  async function loadDetails() {
    try {
      currentLandlord = await fetchAPI(`/properties/landlords/${landlordId}/`);

      // Populate Left Profile Card Data
      document.getElementById('display-header-name').textContent = currentLandlord.name || 'LANDLORD';
      document.getElementById('page-title-name').textContent = (currentLandlord.name || 'LANDLORD PROFILE').toUpperCase();
      document.getElementById('val-landlord-id').textContent = currentLandlord.landlord_id || currentLandlord.landlord_number || currentLandlord.id || '-';
      document.getElementById('val-name').textContent = currentLandlord.name || '-';
      document.getElementById('val-gender').textContent = currentLandlord.gender || '-';
      document.getElementById('val-id-number').textContent = currentLandlord.id_number || '-';
      document.getElementById('val-primary-contact').textContent = currentLandlord.phone_number || currentLandlord.primary_contact || '-';
      document.getElementById('val-secondary-contact').textContent = currentLandlord.secondary_contact || '-';
      document.getElementById('val-email').textContent = currentLandlord.email || currentLandlord.email_address || '-';
      document.getElementById('val-physical-address').textContent = currentLandlord.address || currentLandlord.physical_address || '-';
      document.getElementById('val-postal-address').textContent = currentLandlord.postal_address || '-';
      document.getElementById('val-bank-name').textContent = currentLandlord.bank_name || '-';
      document.getElementById('val-account-name').textContent = currentLandlord.account_name || '-';
      document.getElementById('val-account-number').textContent = currentLandlord.account_number || '-';
      document.getElementById('val-reg-date').textContent = currentLandlord.registration_date || currentLandlord.created_at || '-';

      // Determine status from status string or is_active boolean
      const currentStatus = (currentLandlord.is_active === false) ? 'suspended' : (currentLandlord.status || 'active');
      updateStatusUI(currentStatus);

      // Fetch Properties associated with this Landlord ID
      const propertiesData = await fetchAPI(`/properties/?landlord=${landlordId}`);
      const properties = propertiesData.results || propertiesData || [];
      renderPropertiesTable(properties);

    } catch (err) {
      console.error('Failed to load landlord details:', err);
      alert(`Error loading landlord data: ${err.message}`);
    }
  }

  // --- Helper to toggle Status Colors and Labels ---
  function updateStatusUI(status) {
    const isSuspended = String(status).toLowerCase() === 'suspended' || status === false;

    if (statusBadgeBtn) {
      statusBadgeBtn.textContent = isSuspended ? 'Landlord is suspended' : 'Landlord is active';
      statusBadgeBtn.style.backgroundColor = isSuspended ? '#e74c3c' : '#27ae60';
    }

    if (suspendBtn) {
      suspendBtn.textContent = isSuspended ? 'Activate' : 'Suspend';
      suspendBtn.style.backgroundColor = isSuspended ? '#27ae60' : '#f39c12';
    }
  }

  // --- Render Associated Properties ---
  function renderPropertiesTable(properties) {
    const tbody = document.querySelector('#landlord-properties-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!properties || properties.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 15px;">No properties registered under this landlord.</td></tr>`;
      return;
    }

    properties.forEach((prop, idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${idx + 1}</td>
        <td><a href="property-details.html?id=${prop.id}" class="link-dashed"><strong>${prop.property_id || prop.title || 'pro' + prop.id}</strong></a></td>
        <td>${prop.cluster || 'a'}</td>
        <td>${prop.name || '-'}</td>
        <td>${prop.description || '-'}</td>
        <td>${prop.location || '-'}</td>
        <td>${prop.total_units || prop.units_count || 0}</td>
        <td>${prop.commission_percentage || '7.00'}%</td>
        <td><span class="badge badge-success">${prop.status || 'active'}</span></td>
      `;
      tbody.appendChild(row);
    });
  }

  // --- BUTTON EVENT LISTENERS ---

  // 1. Suspend / Activate Toggle Button
  if (suspendBtn) {
    suspendBtn.addEventListener('click', async () => {
      if (!currentLandlord) return;
      
      const isCurrentlySuspended = (currentLandlord.is_active === false) || ((currentLandlord.status || '').toLowerCase() === 'suspended');
      const targetIsActive = isCurrentlySuspended; // If currently suspended, target state is active (true)
      const targetStatus = targetIsActive ? 'active' : 'suspended';

      if (!confirm(`Are you sure you want to change status to "${targetStatus}"?`)) return;

      try {
        const updated = await fetchAPI(`/properties/landlords/${landlordId}/`, {
          method: 'PATCH',
          body: JSON.stringify({ 
            is_active: targetIsActive,
            status: targetStatus 
          })
        });
        
        currentLandlord.is_active = updated.is_active !== undefined ? updated.is_active : targetIsActive;
        currentLandlord.status = updated.status || targetStatus;
        
        updateStatusUI(currentLandlord.status);
        alert(`Landlord status successfully updated to ${targetStatus}!`);
        await loadDetails();
      } catch (err) {
        console.error('Status patch error:', err);
        alert(`Failed to update status: ${err.message}`);
      }
    });
  }

  // 2. Delete Landlord Button
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!currentLandlord) return;

      const confirmDelete = confirm(`Are you sure you want to DELETE landlord "${currentLandlord.name || landlordId}"?\nThis action cannot be undone.`);
      if (!confirmDelete) return;

      try {
        await fetchAPI(`/properties/landlords/${landlordId}/`, {
          method: 'DELETE'
        });
        alert('Landlord successfully deleted.');
        window.location.href = 'landlords.html';
      } catch (err) {
        console.error('Delete error:', err);
        alert(`Failed to delete landlord: ${err.message}`);
      }
    });
  }

  // 3. Edit Landlord Button (Inline / Form Editing Mode)
  if (editBtn) {
    editBtn.addEventListener('click', async () => {
      if (!currentLandlord) return;

      const isEditing = editBtn.dataset.editing === 'true';

      // Mapped to match Django Model field names exactly
      const fieldsToEdit = [
        { key: 'name', elementId: 'val-name' },
        { key: 'gender', elementId: 'val-gender' },
        { key: 'id_number', elementId: 'val-id-number' },
        { key: 'phone_number', elementId: 'val-primary-contact' },
        { key: 'secondary_contact', elementId: 'val-secondary-contact' },
        { key: 'email', elementId: 'val-email' },
        { key: 'address', elementId: 'val-physical-address' },
        { key: 'postal_address', elementId: 'val-postal-address' },
        { key: 'bank_name', elementId: 'val-bank-name' },
        { key: 'account_name', elementId: 'val-account-name' },
        { key: 'account_number', elementId: 'val-account-number' }
      ];

      if (!isEditing) {
        // Switch to Edit Mode: Replace text display with input fields
        fieldsToEdit.forEach(field => {
          const el = document.getElementById(field.elementId);
          if (el) {
            const currentValue = currentLandlord[field.key] || '';
            el.innerHTML = `<input type="text" id="edit-${field.key}" value="${currentValue}" style="width: 100%; padding: 4px; font-size: 13px; border: 1px solid #cbd5e0; border-radius: 4px; background: #fff;">`;
          }
        });

        editBtn.textContent = 'Save Changes';
        editBtn.style.backgroundColor = '#27ae60';
        editBtn.dataset.editing = 'true';
      } else {
        // Switch to Save Mode: Collect input data and send PATCH request
        const updatedData = {};
        fieldsToEdit.forEach(field => {
          const inputEl = document.getElementById(`edit-${field.key}`);
          if (inputEl) {
            updatedData[field.key] = inputEl.value.trim();
          }
        });

        try {
          const updated = await fetchAPI(`/properties/landlords/${landlordId}/`, {
            method: 'PATCH',
            body: JSON.stringify(updatedData)
          });

          currentLandlord = updated;
          alert('Landlord details updated successfully!');
          
          editBtn.textContent = 'Edit Landlord';
          editBtn.style.backgroundColor = '';
          editBtn.dataset.editing = 'false';
          await loadDetails();
        } catch (err) {
          console.error('Edit error:', err);
          alert(`Failed to update landlord details: ${err.message}`);
        }
      }
    });
  }

  // 4. Add Property Button Redirect
  if (addPropertyBtn) {
    addPropertyBtn.addEventListener('click', () => {
      window.location.href = `properties.html?action=new&landlord_id=${landlordId}`;
    });
  }

  // Initial Load Trigger
  await loadDetails();
});