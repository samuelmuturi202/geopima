document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'https://geopima.onrender.com/api/v1';

  async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.detail || Object.entries(errorData)
        .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
        .join('\n');
      throw new Error(message || `API Error ${response.status}: ${response.statusText}`);
    }
    if (response.status === 204) return null;
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
  const entriesSelect = document.getElementById('entries-select');
  const pagination = document.getElementById('vote-heads-pagination');
  let voteHeadsData = [];
  let currentPage = 1;
  let rowsPerPage = Number(entriesSelect?.value || 10);

  function renderTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
      currentPage = 1;
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 15px;">No vote heads found</td></tr>`;
      if (tableInfo) tableInfo.textContent = 'Showing 0 to 0 of 0 entries';
      renderPagination(0);
      return;
    }

    const pageCount = Math.ceil(data.length / rowsPerPage);
    currentPage = Math.min(currentPage, pageCount);
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = data.slice(start, start + rowsPerPage);
    pageData.forEach((item, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${start + index + 1}</td>
        <td><strong>${item.name || item.title || ''}</strong></td>
        <td>${item.description || '-'}</td>
        <td>-</td>
        <td>${item.amount ? `KES ${Number(item.amount).toLocaleString()}` : '-'}</td>
        <td>
          <button type="button" class="vote-head-edit" data-id="${item.id}">Edit</button>
          <button type="button" class="vote-head-delete" data-id="${item.id}">Delete</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    if (tableInfo) {
      tableInfo.textContent = `Showing ${start + 1} to ${Math.min(start + rowsPerPage, data.length)} of ${data.length} entries`;
    }
    renderPagination(pageCount);

    tableBody.querySelectorAll('.vote-head-edit').forEach(button => {
      button.addEventListener('click', async () => {
        const item = data.find(voteHead => String(voteHead.id) === button.dataset.id);
        if (!item) return;
        const name = prompt('Vote head name:', item.name || item.title || '');
        if (name === null) return;
        const code = prompt('Vote head code:', item.code || '');
        if (code === null) return;
        const description = prompt('Description:', item.description || '');
        if (description === null) return;
        try {
          await fetchAPI(`/billing/vote-heads/${item.id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ name: name.trim(), code: code.trim(), description: description.trim() })
          });
          await loadVoteHeads(searchInput?.value.trim() || '');
        } catch (error) {
          alert(`Failed to update vote head: ${error.message}`);
        }
      });
    });

    tableBody.querySelectorAll('.vote-head-delete').forEach(button => {
      button.addEventListener('click', async () => {
        const item = data.find(voteHead => String(voteHead.id) === button.dataset.id);
        if (!item || !confirm(`Delete vote head "${item.name || item.title}"?`)) return;
        try {
          await fetchAPI(`/billing/vote-heads/${item.id}/`, { method: 'DELETE' });
          await loadVoteHeads(searchInput?.value.trim() || '');
        } catch (error) {
          alert(`Failed to delete vote head: ${error.message}`);
        }
      });
    });
  }

  function renderPagination(pageCount) {
    if (!pagination) return;
    pagination.replaceChildren();
    const addButton = (label, page, disabled = false, active = false) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `page-btn${disabled ? ' disabled' : ''}${active ? ' active' : ''}`;
      button.textContent = label;
      button.disabled = disabled;
      button.addEventListener('click', () => {
        currentPage = page;
        renderTable(voteHeadsData);
      });
      item.appendChild(button);
      pagination.appendChild(item);
    };
    addButton('Previous', Math.max(1, currentPage - 1), currentPage <= 1);
    for (let page = 1; page <= pageCount; page += 1) addButton(String(page), page, false, page === currentPage);
    addButton('Next', Math.min(pageCount, currentPage + 1), pageCount === 0 || currentPage >= pageCount);
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
      voteHeadsData = list;
      currentPage = 1;
      renderTable(voteHeadsData);
      if (!searchQuery) renderPriorityList(list);
    } catch (err) {
      console.error('Failed to fetch vote heads:', err);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red; padding:15px;">Error loading vote heads from server</td></tr>`;
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
  if (entriesSelect) {
    entriesSelect.addEventListener('change', () => {
      rowsPerPage = Number(entriesSelect.value);
      currentPage = 1;
      renderTable(voteHeadsData);
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

  const addVoteHeadBtn = document.getElementById('add-vote-head-btn');
  if (addVoteHeadBtn) {
    addVoteHeadBtn.addEventListener('click', async () => {
      const name = prompt('Vote head name:');
      if (name === null) return;
      const code = prompt('Vote head code:');
      if (code === null) return;
      const description = prompt('Description (optional):') || '';
      try {
        await fetchAPI('/billing/vote-heads/', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), code: code.trim(), description: description.trim() })
        });
        await loadVoteHeads();
      } catch (error) {
        alert(`Failed to create vote head: ${error.message}`);
      }
    });
  }

  loadVoteHeads();
});