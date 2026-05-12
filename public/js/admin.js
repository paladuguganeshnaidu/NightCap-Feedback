// Theme Toggle
const themeToggle = document.getElementById('themeToggle');
const currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);

themeToggle.addEventListener('click', () => {
  let theme = document.documentElement.getAttribute('data-theme');
  let newTheme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
});

// Elements
const loginContainer = document.getElementById('loginContainer');
const dashboardContainer = document.getElementById('dashboardContainer');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

const configForm = document.getElementById('configForm');
const redirectUrlInput = document.getElementById('redirectUrl');
const configMsg = document.getElementById('configMsg');

const tableBody = document.getElementById('tableBody');
const logsBody = document.getElementById('logsBody');
const refreshBtn = document.getElementById('refreshBtn');
const searchInput = document.getElementById('searchInput');

const clearDataBtn = document.getElementById('clearDataBtn');
const clearModal = document.getElementById('clearModal');
const closeClearModal = document.getElementById('closeClearModal');
const clearForm = document.getElementById('clearForm');
const clearPassword = document.getElementById('clearPassword');
const clearError = document.getElementById('clearError');

let allData = [];

// Auth State
const getToken = () => localStorage.getItem('adminToken');
const setToken = (token) => localStorage.setItem('adminToken', token);
const removeToken = () => localStorage.removeItem('adminToken');

const checkAuth = () => {
  if (getToken()) {
    loginContainer.style.display = 'none';
    dashboardContainer.style.display = 'block';
    logoutBtn.style.display = 'block';
    loadDashboard();
  } else {
    loginContainer.style.display = 'flex';
    dashboardContainer.style.display = 'none';
    logoutBtn.style.display = 'none';
  }
};

const apiFetch = async (url, options = {}) => {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    removeToken();
    checkAuth();
    throw new Error('Unauthorized');
  }
  return res;
};

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('password').value;
  
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setToken(data.token);
      checkAuth();
    } else {
      loginError.textContent = data.message || 'Login failed';
      loginError.classList.add('show');
    }
  } catch (err) {
    loginError.textContent = 'Network error';
    loginError.classList.add('show');
  }
});

// Logout
logoutBtn.addEventListener('click', () => {
  removeToken();
  checkAuth();
});

// Load Dashboard Data
const loadDashboard = async () => {
  await fetchConfig();
  await fetchData();
  await fetchLogs();
};

const fetchConfig = async () => {
  try {
    const res = await apiFetch('/api/admin/config');
    const data = await res.json();
    if (data.success) {
      redirectUrlInput.value = data.redirect_url;
    }
  } catch(e) {}
};

configForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = redirectUrlInput.value;
  try {
    const res = await apiFetch('/api/admin/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirect_url: url })
    });
    if (res.ok) {
      configMsg.style.display = 'block';
      setTimeout(() => configMsg.style.display = 'none', 3000);
      fetchLogs();
    }
  } catch(e) {}
});

const fetchData = async () => {
  try {
    const res = await apiFetch('/api/submissions');
    const result = await res.json();
    if (res.ok && result.success) {
      allData = result.data;
      renderTable(allData);
    }
  } catch (e) {}
};

const fetchLogs = async () => {
  try {
    const res = await apiFetch('/api/admin/logs');
    const result = await res.json();
    if (res.ok && result.success) {
      if (result.data.length === 0) {
        logsBody.innerHTML = '<tr><td colspan="3">No logs yet</td></tr>';
      } else {
        logsBody.innerHTML = result.data.map(log => `
          <tr>
            <td>${new Date(log.created_at + 'Z').toLocaleString()}</td>
            <td><strong>${log.action}</strong></td>
            <td>${log.details}</td>
          </tr>
        `).join('');
      }
    }
  } catch (e) {}
};

const renderTable = (data) => {
  if (data.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No submissions found.</td></tr>';
    return;
  }
  
  tableBody.innerHTML = data.map(row => `
    <tr>
      <td>${row.id}</td>
      <td style="font-family: monospace; font-weight: bold; color: var(--gemini-purple);">${row.usn}</td>
      <td>${row.name}</td>
      <td>${new Date(row.submitted_at + 'Z').toLocaleString()}</td>
      <td>
        <button class="btn-danger btn-small" onclick="deleteSubmission(${row.id})">Delete</button>
      </td>
    </tr>
  `).join('');
};

searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allData.filter(row => 
    row.usn.toLowerCase().includes(query) || 
    row.name.toLowerCase().includes(query)
  );
  renderTable(filtered);
});

refreshBtn.addEventListener('click', () => {
  fetchData();
  fetchLogs();
});

// Delete Single Submission
window.deleteSubmission = async (id) => {
  if (confirm(`Are you sure you want to delete submission ID ${id}?`)) {
    try {
      const res = await apiFetch(`/api/admin/submission/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
        fetchLogs();
      } else {
        alert('Failed to delete');
      }
    } catch(e) {}
  }
};

// Clear All Data Modal
clearDataBtn.addEventListener('click', () => {
  clearModal.classList.add('show');
  clearPassword.value = '';
  clearError.classList.remove('show');
});

closeClearModal.addEventListener('click', () => {
  clearModal.classList.remove('show');
});

clearForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass = clearPassword.value;
  
  try {
    const res = await apiFetch('/api/admin/clear', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      clearModal.classList.remove('show');
      fetchData();
      fetchLogs();
      alert('All data cleared.');
    } else {
      clearError.textContent = data.message || 'Failed';
      clearError.classList.add('show');
    }
  } catch(e) {
    clearError.textContent = 'Network error';
    clearError.classList.add('show');
  }
});

// Init
checkAuth();
