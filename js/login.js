// js/login.js

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    // Find the submit button to show loading status (handles Render free tier spin-down delay)
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalButtonText = submitBtn ? submitBtn.textContent : 'Sign In';

    if (submitBtn) {
        submitBtn.textContent = 'Connecting (Waking up server)...';
        submitBtn.disabled = true;
    }

    try {
        const response = await fetch('https://geopima.onrender.com/api/v1/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            if (
                typeof data.access !== 'string' ||
                !data.access ||
                !data.user ||
                typeof data.user !== 'object' ||
                !Array.isArray(data.user.permissions) ||
                typeof data.user.is_superuser !== 'boolean'
            ) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('user_data');
                throw new Error('The server returned an incomplete user authorization profile.');
            }

            // Save JWT Tokens
            localStorage.setItem('access_token', data.access);
            if (data.refresh) {
                localStorage.setItem('refresh_token', data.refresh);
            }

            // Save user data safely as a JSON string
            localStorage.setItem('user_data', JSON.stringify(data.user));

            // Redirect to dashboard page
            window.location.href = 'dashboard.html';
        } else {
            alert(data.detail || 'Invalid login credentials.');
        }
    } catch (err) {
        console.error('Login error:', err);
        alert(err.message || 'Could not connect to the server. If Render was asleep, please wait 30 seconds and try clicking Sign In again.');
    } finally {
        // Restore button state
        if (submitBtn) {
            submitBtn.textContent = originalButtonText;
            submitBtn.disabled = false;
        }
    }
});