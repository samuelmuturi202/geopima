// js/script.js

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'https://geopima.onrender.com/api/v1';

  /**
   * Helper to retrieve access token across common localStorage key variations
   */
  function getStoredAccessToken() {
    return localStorage.getItem('access_token') || 
           localStorage.getItem('accessToken') || 
           localStorage.getItem('token');
  }

  /**
   * Helper to retrieve refresh token across common localStorage key variations
   */
  function getStoredRefreshToken() {
    return localStorage.getItem('refresh_token') || 
           localStorage.getItem('refreshToken');
  }

  /**
   * Helper function to refresh JWT access token if expired
   */
  async function refreshAccessToken() {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('access_token', data.access);
        return data.access;
      }
    } catch (err) {
      console.error('Failed to refresh access token:', err);
    }

    return null;
  }

  /**
   * Centralized API fetch wrapper with automated JWT Authorization headers and auto-refresh
   */
  async function fetchAPI(endpoint, options = {}) {
    let token = getStoredAccessToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };

    let response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });

    // Handle 401 Unauthorized or 403 Forbidden token expiration
    if (response.status === 401 || response.status === 403) {
      console.warn(`[${response.status}] Attempting token refresh for ${endpoint}`);
      const newToken = await refreshAccessToken();

      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
      } else if (response.status === 401) {
        console.warn('Session expired. Redirecting to login.');
        localStorage.clear();
        window.location.href = 'login.html';
        throw new Error('Unauthorized: Session expired.');
      }
    }

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggle-sidebar');
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');

  // --- 1. Persistent Sidebar Collapse/Expand Logic ---
  const applySidebarState = (isCollapsed) => {
    if (!sidebar) return;
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
    } else {
      sidebar.classList.remove('collapsed');
    }
  };

  const savedSidebarState = localStorage.getItem('sidebarState');
  if (savedSidebarState !== null) {
    applySidebarState(savedSidebarState === 'collapsed');
  } else {
    applySidebarState(true);
  }

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();

      if (window.innerWidth <= 768) {
        sidebar.classList.toggle('mobile-open');
      } else {
        const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');
        const nextState = !isCurrentlyCollapsed;
        applySidebarState(nextState);
        localStorage.setItem('sidebarState', nextState ? 'collapsed' : 'expanded');
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('mobile-open')) {
      if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
        sidebar.classList.remove('mobile-open');
      }
    }
  });

  // --- 2. Light/Dark Mode Switch Handler ---
  const applyTheme = (isDark) => {
    if (isDark) {
      document.body.classList.add('dark-mode');
      if (themeIcon) themeIcon.className = 'fa-solid fa-sun';
    } else {
      document.body.classList.remove('dark-mode');
      if (themeIcon) themeIcon.className = 'fa-solid fa-moon';
    }
  };

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    applyTheme(true);
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-mode');
      applyTheme(isDark);
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }

  // --- 3. Submenu / Dropdown Handler ---
  const setupDropdownToggle = (toggleId) => {
    const toggleButton = document.getElementById(toggleId);
    const dropdown = toggleButton ? toggleButton.closest('.nav-dropdown') : null;

    if (toggleButton && dropdown) {
      toggleButton.addEventListener('click', (e) => {
        e.preventDefault();
        dropdown.classList.toggle('open');
      });
    }
  };

  setupDropdownToggle('finance-dropdown-toggle');
  setupDropdownToggle('fees-dropdown-toggle');

  // --- 4. Navigation Link Handlers ---
  const navLinks = document.querySelectorAll('.nav-menu a');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetUrl = link.getAttribute('href');
      if (targetUrl && targetUrl !== '#' && !targetUrl.startsWith('javascript:')) {
        window.location.href = targetUrl;
      }
    });
  });

  // --- 5. Dynamic Chart.js Population Distribution Chart ---
  const chartCanvas = document.getElementById('populationChart');
  let populationChartInstance = null;

  async function renderDynamicChart() {
    if (!chartCanvas) return;

    try {
      const metrics = await fetchAPI('/dashboard/metrics/');
      const propertyLabels = metrics.properties || [];
      const totalUnits = metrics.total_units || [];
      const occupiedUnits = metrics.occupied_units || [];

      const ctx = chartCanvas.getContext('2d');
      populationChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: propertyLabels,
          datasets: [
            {
              label: 'Total Units',
              data: totalUnits,
              backgroundColor: '#0099b8'
            },
            {
              label: 'Units Occupied',
              data: occupiedUnits,
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
              beginAtZero: true
            }
          }
        }
      });
    } catch (err) {
      console.error('Failed to load chart metrics from API:', err);
    }
  }

  window.addEventListener('resize', () => {
    if (populationChartInstance) {
      populationChartInstance.resize();
    }
  });

  // --- 6. Dynamic Payment Summary Progress Bars ---
  const summaryContainer = document.getElementById('payment-summary-container');

  async function renderPaymentSummary() {
    if (!summaryContainer) return;

    try {
      const paymentData = await fetchAPI('/dashboard/payment-summaries/');
      summaryContainer.innerHTML = '';

      const items = Array.isArray(paymentData) ? paymentData : (paymentData.results || []);
      
      if (items.length === 0) {
        summaryContainer.innerHTML = '<p style="color: #718096; font-size: 14px;">No payment summaries available.</p>';
        return;
      }

      items.forEach(item => {
        const pct = item.pct || 0;
        const isSuccess = pct >= 100;
        const itemEl = document.createElement('div');
        itemEl.className = 'progress-item';

        itemEl.innerHTML = `
          <div class="progress-header">
            <span>${item.name || 'N/A'}</span>
            <span>${Number(item.collected || 0).toLocaleString()}/${Number(item.total || 0).toLocaleString()} (${pct}%)</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill ${isSuccess ? 'success' : ''}" style="width: ${Math.min(pct, 100)}%;"></div>
          </div>
        `;

        summaryContainer.appendChild(itemEl);
      });
    } catch (err) {
      console.error('Failed to load payment progress summaries:', err);
      if (summaryContainer) {
        summaryContainer.innerHTML = '<p style="color: #e53e3e; font-size: 14px;">Failed to load payment summaries.</p>';
      }
    }
  }

  renderDynamicChart();
  renderPaymentSummary();
});