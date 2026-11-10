(function () {
  const permissionByPage = {
    'index.html': 'reports_access',
    'collect-rent.html': 'payment_access',
    'finance.html': 'payment_access',
    'mpesa.html': 'payment_access',
    'coop.html': 'payment_access',
    'invoices.html': 'fee_access',
    'invoice.html': 'fee_access',
    'invoice_details.html': 'fee_access',
    'deposits.html': 'fee_access',
    'discounts.html': 'fee_access',
    'vote-heads.html': 'votehead_access',
    'landlords.html': 'landlord_access',
    'landlord-details.html': 'landlord_access',
    'properties.html': 'property_access',
    'property_detail.html': 'property_access',
    'unit.html': 'unit_access',
    'unit_detail.html': 'unit_access',
    'tenants.html': 'tenant_access',
    'tenant-detail.html': 'tenant_access',
    'communication.html': 'message_access',
    'configuration.html': 'settings_access',
    'promote-month.html': 'settings_access',
    'agency-profile.html': 'settings_access',
    'agreement-templates.html': 'settings_access',
    'collection-banks.html': 'payment_access',
    'sms-templates.html': 'message_access',
    'users.html': 'user_access',
    'user-roles.html': 'user_access',
    'role-permissions.html': 'user_access'
  };

  const apiBaseUrl = 'https://geopima.onrender.com/api/v1';
  let currentUser = null;
  let deniedScreen = null;
  let deniedElements = [];

  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem('user_data') || 'null');
    } catch (error) {
      console.error('Could not read the saved user authorization profile:', error);
      return null;
    }
  }

  function permissionForUrl(href) {
    if (!href || href === '#' || href.startsWith('javascript:')) {
      return null;
    }

    let url;
    try {
      url = new URL(href, window.location.href);
    } catch (error) {
      return null;
    }
    if (url.origin !== window.location.origin) {
      return null;
    }

    const page = url.pathname.split('/').pop().toLowerCase();
    return permissionByPage[page] || null;
  }

  function canAccess(permission) {
    if (!permission) {
      return true;
    }
    if (currentUser?.is_superuser === true) {
      return true;
    }
    return Array.isArray(currentUser?.permissions)
      && currentUser.permissions.includes(permission);
  }

  function getFallbackUrl() {
    const path = window.location.pathname;
    const configurationIndex = path.toLowerCase().indexOf('/configuration/');
    const appRoot = configurationIndex >= 0
      ? path.slice(0, configurationIndex + 1)
      : path.slice(0, path.lastIndexOf('/') + 1);
    const destinations = [
      ['index.html', 'reports_access'],
      ['properties.html', 'property_access'],
      ['tenants.html', 'tenant_access'],
      ['landlords.html', 'landlord_access'],
      ['unit.html', 'unit_access'],
      ['invoices.html', 'fee_access'],
      ['collect-rent.html', 'payment_access'],
      ['communication.html', 'message_access'],
      ['configuration.html', 'settings_access'],
      ['configuration/users.html', 'user_access']
    ];
    const destination = destinations.find(([, permission]) => canAccess(permission));
    return destination
      ? `${appRoot}${destination[0]}`
      : `${appRoot}login.html`;
  }

  function showDeniedScreen() {
    if (deniedScreen || !document.body) {
      return;
    }

    const overlay = document.createElement('main');
    overlay.setAttribute('role', 'alert');
    overlay.setAttribute('aria-live', 'assertive');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:24px',
      'background:#f8fafc',
      'font-family:Arial,sans-serif',
      'text-align:center'
    ].join(';');

    const panel = document.createElement('div');
    panel.style.cssText = 'max-width:480px;padding:32px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.12)';

    const heading = document.createElement('h1');
    heading.textContent = 'Access denied';
    heading.style.cssText = 'margin:0 0 12px;color:#1e293b;font-size:24px';

    const message = document.createElement('p');
    message.textContent = 'Your assigned role does not have permission to view this page.';
    message.style.cssText = 'margin:0 0 24px;color:#475569;line-height:1.5';

    const link = document.createElement('a');
    link.href = getFallbackUrl();
    link.textContent = link.href.endsWith('login.html')
      ? 'Return to sign in'
      : 'Go to an available page';
    link.style.cssText = 'display:inline-block;padding:10px 16px;border-radius:6px;background:#2563eb;color:#fff;text-decoration:none';

    panel.append(heading, message, link);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    deniedElements = Array.from(document.body.children)
      .filter(element => element !== overlay)
      .map(element => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden')
      }));
    deniedElements.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    deniedScreen = overlay;
  }

  function removeDeniedScreen() {
    if (!deniedScreen) {
      return;
    }
    deniedElements.forEach(({ element, inert, ariaHidden }) => {
      element.inert = inert;
      if (ariaHidden === null) {
        element.removeAttribute('aria-hidden');
      } else {
        element.setAttribute('aria-hidden', ariaHidden);
      }
    });
    deniedElements = [];
    deniedScreen.remove();
    deniedScreen = null;
  }

  function applyRoleBasedNavigation() {
    currentUser = getStoredUser();
    document.querySelectorAll('a[data-role-access-hidden="true"]').forEach(link => {
      link.hidden = false;
      link.removeAttribute('aria-hidden');
      link.removeAttribute('tabindex');
      link.removeAttribute('data-role-access-hidden');
    });
    document.querySelectorAll('li[data-role-access-hidden="true"]').forEach(item => {
      item.hidden = false;
      item.removeAttribute('data-role-access-hidden');
    });
    document.querySelectorAll('a[href]').forEach(link => {
      const permission = permissionForUrl(link.getAttribute('href'));
      if (permission && !canAccess(permission)) {
        link.hidden = true;
        link.setAttribute('data-role-access-hidden', 'true');
        link.setAttribute('aria-hidden', 'true');
        link.setAttribute('tabindex', '-1');
      }
    });

    document.querySelectorAll('.nav-menu li').forEach(item => {
      const childList = Array.from(item.children).find(child => child.tagName === 'UL');
      const visibleChildItems = childList
        ? Array.from(childList.children).some(child => !child.hidden)
        : false;
      const visibleDirectLink = Array.from(item.children).some(
        child => child.matches?.('a[href]') && !child.hidden
      );
      if (!visibleDirectLink && !visibleChildItems) {
        item.hidden = true;
        item.setAttribute('data-role-access-hidden', 'true');
      }
    });

    const permission = permissionForUrl(window.location.pathname);
    if (permission && !canAccess(permission)) {
      showDeniedScreen();
    } else {
      removeDeniedScreen();
    }
  }

  async function refreshAuthorizationProfile() {
    const token = localStorage.getItem('access_token')
      || localStorage.getItem('accessToken')
      || localStorage.getItem('token')
      || localStorage.getItem('access');
    if (!token) {
      applyRoleBasedNavigation();
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/auth/me/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('token');
          localStorage.removeItem('user_data');
          const loginUrl = window.location.pathname.toLowerCase().includes('/configuration/')
            ? '../login.html'
            : 'login.html';
          window.location.href = loginUrl;
          return;
        }
        throw new Error(`Could not refresh role permissions (${response.status}).`);
      }

      currentUser = await response.json();
      localStorage.setItem('user_data', JSON.stringify(currentUser));
    } catch (error) {
      console.error('Could not refresh role permissions for navigation:', error);
      currentUser = getStoredUser();
    }
    applyRoleBasedNavigation();
  }

  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) {
      return;
    }
    const permission = permissionForUrl(link.getAttribute('href'));
    if (permission && !canAccess(permission)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  function initializeRoleBasedNavigation() {
    applyRoleBasedNavigation();
    refreshAuthorizationProfile();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeRoleBasedNavigation, { once: true });
  } else {
    initializeRoleBasedNavigation();
  }
})();
