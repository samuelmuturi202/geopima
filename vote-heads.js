document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

  async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  }

  // 1. Drag and Drop Functionality for Prioritize List
  const priorityList = document.getElementById('priority-list');
  let draggedItem = null;

  if (priorityList) {
    priorityList.addEventListener('dragstart', (e) => {
      if (e.target.classList.contains('priority-item')) {
        draggedItem = e.target;
        e.target.classList.add('dragging');
      }
    });

    priorityList.addEventListener('dragend', (e) => {
      if (e.target.classList.contains('priority-item')) {
        e.target.classList.remove('dragging');
        draggedItem = null;
      }
    });

    priorityList.addEventListener('dragover', (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(priorityList, e.clientY);
      if (draggedItem) {
        if (afterElement == null) {
          priorityList.appendChild(draggedItem);
        } else {
          priorityList.insertBefore(draggedItem, afterElement);
        }
      }
    });
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.priority-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // 2. Fetch and Render Vote Heads Data
  const tableBody = document.querySelector('#vote-heads-table tbody');
  const searchInput = document.getElementById('table-search');
  const tableInfo = document.getElementById('table-info');

  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 15px;">No vote heads found</td></tr>`;
      if (tableInfo) tableInfo.textContent = 'Showing 0 entries';
      return;
    }

    data.forEach((item, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td><strong>${item.name || item.title || ''}</strong></td>
        <td>${item.code || ''}</td>
        <td>${item.description || '-'}</td>
        <td><span class="badge badge-success">${item.status || 'Active'}</span></td>
      `;
      tableBody.appendChild(row);
    });

    if (tableInfo) {
      tableInfo.textContent = `Showing 1 to ${data.length} of ${data.length} entries`;
    }
  }

  function renderPriorityList(data) {
    if (!priorityList) return;
    priorityList.innerHTML = '';

    data.forEach(item => {
      const li = document.createElement('li');
      li.className = 'priority-item';
      li.setAttribute('draggable', 'true');
      li.setAttribute('data-id', item.id);
      li.innerHTML = `<i class="fa-solid fa-grip-lines handle"></i> <span>${item.name || item.title}</span>`;
      priorityList.appendChild(li);
    });
  }

  async function loadVoteHeads(searchQuery = '') {
    try {
      const queryParam = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
      const response = await fetchAPI(`/billing/vote-heads/${queryParam}`);
      const list = response.results || response;
      
      renderTable(list);
      if (!searchQuery) renderPriorityList(list);
    } catch (err) {
      console.error('Failed to fetch vote heads:', err);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red; padding:15px;">Error loading vote heads from server</td></tr>`;
      }
    }
  }

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadVoteHeads(searchInput.value.trim()), 300);
    });
  }

  // 3. Save Priorities to Django Backend
  const saveBtn = document.getElementById('save-priority-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const items = document.querySelectorAll('.priority-item');
      const orderedIds = [...items].map(item => item.getAttribute('data-id'));

      try {
        saveBtn.disabled = true;
        saveBtn.innerText = 'Saving...';

        await fetchAPI('/billing/vote-heads/reorder/', {
          method: 'POST',
          body: JSON.stringify({ priority_order: orderedIds })
        });

        alert('Priority sequence saved successfully to backend!');
      } catch (err) {
        alert('Failed to save priority order: ' + err.message);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Save Priorities';
      }
    });
  }

  loadVoteHeads();
});