document.addEventListener('DOMContentLoaded', () => {

  // 1. Sidebar Collapse/Expand Toggle
  const toggleBtn = document.getElementById('toggle-sidebar');
  const sidebar = document.getElementById('sidebar');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  // 2. Generic Dropdown Toggle Handler (Finance & Fees Setup)
  const setupDropdownToggle = (toggleId) => {
    const toggleBtn = document.getElementById(toggleId);
    const dropdown = toggleBtn ? toggleBtn.closest('.nav-dropdown') : null;

    if (toggleBtn && dropdown) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        dropdown.classList.toggle('open');
      });
    }
  };

  // Initialize Finance and Fees Setup Dropdowns
  setupDropdownToggle('finance-dropdown-toggle');
  setupDropdownToggle('fees-dropdown-toggle');

  // Handle direct page navigation when any submenu item is clicked
  const submenuLinks = document.querySelectorAll('.submenu a');
  submenuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetUrl = link.getAttribute('href');

      // Navigate to the target URL if defined and not just '#'
      if (targetUrl && targetUrl !== '#') {
        window.location.href = targetUrl;
      }
    });
  });

  // 3. Dedicated Navigation Links (Landlords & Properties)
  const setupNavLink = (linkId) => {
    const navLink = document.getElementById(linkId);
    if (navLink) {
      navLink.addEventListener('click', (e) => {
        const targetUrl = navLink.getAttribute('href');
        if (targetUrl && targetUrl !== '#') {
          window.location.href = targetUrl;
        }
      });
    }
  };

  setupNavLink('landlords-link');
  setupNavLink('properties-link');

  // 4. Population Distribution Chart (Chart.js - Only runs on Dashboard page)
  const chartCanvas = document.getElementById('populationChart');
  if (chartCanvas) {
    const ctx = chartCanvas.getContext('2d');
    const propertyLabels = [
      'Agnes njambi', 'Alice Njuguna', 'Alice Plot', 'Annastacia Plot', 'Benard Njunge B',
      'Benard Njunge A', 'Charity MUTHONI Nduta', 'Daniel mwangi', 'Daniel Plot', 'David chege',
      'David kaime', 'David Kamau', 'Dawaki', 'Dorothy', 'Elizabeth Plot', 'Esther wairimu B',
      'Esther wairimu', 'Fide A Plot', 'George Kimani ndungu', 'Githima Women Guild plot',
      'Grace', 'Grace Gaitho', 'Harrison Plot', 'HENRY NJOROGE', 'Isaac githiora'
    ];

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: propertyLabels,
        datasets: [
          {
            label: 'Total Units',
            data: [20, 8, 8, 18, 12, 12, 12, 42, 24, 20, 8, 20, 20, 80, 50, 8, 30, 8, 12, 32, 30, 12, 14, 12, 12],
            backgroundColor: '#0099b8'
          },
          {
            label: 'Units Occupied',
            data: [16, 6, 6, 14, 10, 8, 8, 34, 18, 16, 6, 18, 16, 76, 36, 6, 28, 4, 10, 28, 28, 10, 10, 8, 10],
            backgroundColor: '#2bb14c'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: {
              font: { size: 10 },
              maxRotation: 60,
              minRotation: 60
            }
          },
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
  }

  // 5. Render Payment Summary Progress Bars (Only runs on Dashboard page)
  const summaryContainer = document.getElementById('payment-summary-container');
  if (summaryContainer) {
    const paymentData = [
      { name: "Agnes njambi", collected: 0, total: 51750, pct: 0 },
      { name: "Alice Njuguna", collected: 18120, total: 48240, pct: 38 },
      { name: "Alice Plot", collected: 0, total: 21500, pct: 0 },
      { name: "Annastacia Plot", collected: 1400, total: 55900, pct: 3 },
      { name: "Benard Njunge B", collected: 4000, total: 31300, pct: 13 },
      { name: "Benard Njunge A", collected: 6000, total: 28500, pct: 21 },
      { name: "Charity MUTHONI Nduta", collected: 10850, total: 53750, pct: 20 },
      { name: "Daniel mwangi", collected: 6000, total: 41100, pct: 15 },
      { name: "Daniel Plot", collected: 16000, total: 109250, pct: 15 },
      { name: "David chege", collected: 14700, total: 61500, pct: 24 },
      { name: "Grace", collected: 48000, total: 47000, pct: 102 }
    ];

    paymentData.forEach(item => {
      const isSuccess = item.pct >= 100;
      const itemEl = document.createElement('div');
      itemEl.className = 'progress-item';
      
      itemEl.innerHTML = `
        <div class="progress-header">
          <span>${item.name}</span>
          <span>${item.collected.toLocaleString()}/${item.total.toLocaleString()} (${item.pct}%)</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill ${isSuccess ? 'success' : ''}" style="width: ${Math.min(item.pct, 100)}%;"></div>
        </div>
      `;

      summaryContainer.appendChild(itemEl);
    });
  }

});