document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('http://127.0.0.1:8000/api/v1/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Save JWT Tokens
            localStorage.setItem('access_token', data.access);
            if (data.refresh) {
                localStorage.setItem('refresh_token', data.refresh);
            }

            // Fallback: If backend returns data.user, use it; otherwise build a valid user object
            const userObj = data.user || {
                username: username,
                full_name: username,
                is_superuser: true,
                permissions: [],
                roles: []
            };

            // Save user data safely as a JSON string
            localStorage.setItem('user_data', JSON.stringify(userObj));

            // Redirect to dashboard page
            window.location.href = 'dashboard.html';
        } else {
            alert(data.detail || 'Invalid login credentials.');
        }
    } catch (err) {
        console.error('Login error:', err);
        alert('Could not connect to the server. Please ensure the backend is running.');
    }
});