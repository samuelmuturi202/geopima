document.addEventListener('DOMContentLoaded', () => {

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

  // 2. Live Table Search Filter
  const searchInput = document.getElementById('table-search');
  const tableRows = document.querySelectorAll('#vote-heads-table tbody tr');
  const tableInfo = document.getElementById('table-info');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase().trim();
      let visibleRows = 0;

      tableRows.forEach(row => {
        const rowText = row.textContent.toLowerCase();
        if (rowText.includes(query)) {
          row.style.display = '';
          visibleRows++;
        } else {
          row.style.display = 'none';
        }
      });

      if (tableInfo) {
        tableInfo.textContent = `Showing 1 to ${visibleRows} of ${tableRows.length} entries`;
      }
    });
  }

  // 3. Save Priorities Notification
  const saveBtn = document.getElementById('save-priority-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const currentOrder = [...document.querySelectorAll('.priority-item span')].map(item => item.textContent);
      console.log('Saved Priority Order:', currentOrder);
      alert('Priority sequence saved successfully!');
    });
  }

});