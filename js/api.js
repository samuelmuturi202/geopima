// js/api.js

/**
 * Base configuration for API integration
 */
const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

/**
 * Safely retrieves and parses the user object from localStorage.
 */
function getStoredUser() {
    const userJson = localStorage.getItem('user_data');
    if (!userJson || userJson === 'undefined' || userJson === 'null') {
        return null;
    }
    try {
        return JSON.parse(userJson);
    } catch (err) {
        console.error('Error parsing user_data from localStorage:', err);
        return null;
    }
}

/**
 * Centralized API fetch wrapper with automated JWT Authorization headers 
 * and automatic JSON body serialization.
 */
async function fetchAPI(endpoint, options = {}) {
    let token = localStorage.getItem('access_token') || localStorage.getItem('token') || localStorage.getItem('access');

    const headers = {
        // Only set Content-Type to application/json if the body is not FormData (e.g. file uploads)
        ...(!(options.body instanceof FormData) && { 'Content-Type': 'application/json' }),
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };

    // Automatically stringify plain JavaScript objects passed as request bodies
    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
        body = JSON.stringify(body);
    }

    console.log(`[API Request] ${endpoint} -> Auth Header Attached:`, headers['Authorization'] ? 'Yes (Bearer Token Present)' : 'No (Missing Token!)');

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
            body
        });

        if (response.status === 401 || response.status === 403) {
            console.warn(`[401/403] Authorization failed for ${endpoint}. Token may be expired or missing.`);
            
            if (!token) {
                console.error("No access token found in localStorage. Please log in first.");
            }
            // Optional: Uncomment below to automatically clear session and kick user to login on 401
            // else {
            //     localStorage.clear();
            //     window.location.href = 'login.html';
            // }
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            let message = '';
            
            if (typeof errorData === 'object' && errorData !== null) {
                if (errorData.detail) {
                    message = errorData.detail;
                } else {
                    message = Object.entries(errorData)
                        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
                        .join('\n');
                }
            }
            throw new Error(message || `API Error ${response.status}: ${response.statusText}`);
        }

        // Handle empty responses (like HTTP 204 No Content)
        if (response.status === 204) {
            return null;
        }

        return await response.json();
    } catch (err) {
        console.error(`Fetch error on ${endpoint}:`, err);
        throw err;
    }
}

/**
 * Populates and updates user display name elements across the layout seamlessly.
 */
function renderHeaderProfile() {
    const user = getStoredUser();
    const token = localStorage.getItem('access_token') || localStorage.getItem('token') || localStorage.getItem('access');

    // List of public pages where the header profile should not trigger a redirect
    const publicPages = ['login.html', 'register.html'];
    const currentPath = window.location.pathname;
    const isPublicPage = publicPages.some(page => currentPath.endsWith(page));

    if (!user && !token) {
        if (!isPublicPage) {
            console.warn('No active authentication session found. Redirecting to login.');
            window.location.href = 'login.html';
        }
        return;
    }

    const displayName = user?.full_name || user?.name || user?.username || 'Peter Mwaniki';

    // 1. Look for existing template user profile nodes in top headers
    const headerRightElements = document.querySelectorAll('.header-right, .user-dropdown');
    headerRightElements.forEach(container => {
        // Check if there's a text span or update text content safely
        const nameSpan = container.querySelector('.user-name, span:not([class])');
        if (nameSpan && !nameSpan.id && !nameSpan.querySelector('button')) {
            nameSpan.textContent = displayName;
        }
    });

    // 2. Fallback: If no injected header display container exists or it needs the dropdown mechanism
    let profileElem = document.getElementById('top-right-user');
    if (!profileElem) {
        // Check if a header-right container already handles it cleanly
        const existingHeaderRight = document.querySelector('.top-header .header-right');
        if (existingHeaderRight && existingHeaderRight.textContent.trim() !== '') {
            return; // Already populated by static layout HTML
        }

        profileElem = document.createElement('div');
        profileElem.id = 'top-right-user';
        profileElem.style.cssText = `
            position: absolute;
            top: 15px;
            right: 25px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 1000;
        `;
        const header = document.querySelector('.top-header');
        if (header) {
            header.appendChild(profileElem);
        } else {
            document.body.insertBefore(profileElem, document.body.firstChild);
        }
    }

    profileElem.innerHTML = `
        <span style="font-weight: bold; color: #2d3748;">${displayName}</span>
        <button id="logout-btn" style="
            padding: 5px 10px; 
            background: #edf2f7; 
            border: 1px solid #cbd5e0; 
            border-radius: 4px; 
            cursor: pointer;">
            Logout
        </button>
    `;

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'login.html';
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;
    // Prevent profile checks from redirecting loops on auth-related pages
    if (!currentPath.endsWith('login.html') && !currentPath.endsWith('register.html') && currentPath !== '/') {
        renderHeaderProfile();
    }
});