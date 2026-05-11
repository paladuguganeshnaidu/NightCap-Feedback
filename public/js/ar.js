// Theme Toggle
const themeToggle = document.getElementById('themeToggle');
const currentTheme = localStorage.getItem('theme') || 'dark';
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
const gidInput = document.getElementById('gid');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

const headerAdminName = document.getElementById('headerAdminName');
const welcomeName = document.getElementById('welcomeName');

const tableBody = document.getElementById('tableBody');
const refreshBtn = document.getElementById('refreshBtn');
const exportBtn = document.getElementById('exportBtn');
const regCount = document.getElementById('regCount');

const mailForm = document.getElementById('mailForm');
const mailSubject = document.getElementById('mailSubject');
const mailBody = document.getElementById('mailBody');
const mailMsg = document.getElementById('mailMsg');

// Check Token
const checkAuth = () => {
  const token = localStorage.getItem('arToken');
  const name = localStorage.getItem('arName');
  if (token && name) {
    showDashboard(name);
  } else {
    showLogin();
  }
};

const showLogin = () => {
  loginContainer.style.display = 'flex';
  dashboardContainer.style.display = 'none';
  logoutBtn.style.display = 'none';
  headerAdminName.textContent = '';
};

const showDashboard = (name) => {
  loginContainer.style.display = 'none';
  dashboardContainer.style.display = 'block';
  logoutBtn.style.display = 'block';
  headerAdminName.textContent = `- ${name}`;
  welcomeName.textContent = name;
  fetchData();
};

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.remove('show');
  const btn = loginForm.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    const res = await fetch('/api/ar/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gid: gidInput.value.trim() })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      localStorage.setItem('arToken', data.token);
      localStorage.setItem('arName', data.name);
      showDashboard(data.name);
    } else {
      loginError.textContent = data.message || 'Login failed';
      loginError.classList.add('show');
    }
  } catch (err) {
    loginError.textContent = 'Network error';
    loginError.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Login to Dashboard';
  }
});

// Logout
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('arToken');
  localStorage.removeItem('arName');
  showLogin();
});

// Fetch Data
const fetchData = async () => {
  tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading data...</td></tr>';
  try {
    const token = localStorage.getItem('arToken');
    const res = await fetch('/api/ar/registrations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 401 || res.status === 403) {
      return logoutBtn.click();
    }

    const data = await res.json();
    if (data.success) {
      renderTable(data.data);
      regCount.textContent = data.data.length;
    }
  } catch (err) {
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Failed to load data</td></tr>';
  }
};

const renderTable = (rows) => {
  if (rows.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No registrations assigned to you yet.</td></tr>';
    return;
  }
  
  tableBody.innerHTML = rows.map(r => `
    <tr>
      <td>#${r.id}</td>
      <td style="font-weight: 600;">${r.usn}</td>
      <td>${r.name}</td>
      <td>${r.mobile}</td>
      <td>${r.email}</td>
      <td><span class="branch-tag show" style="position: static; transform: none; display: inline-block;">${r.department}</span></td>
      <td style="font-size: 0.85rem; opacity: 0.8;">${new Date(r.registered_at).toLocaleString()}</td>
    </tr>
  `).join('');
};

refreshBtn.addEventListener('click', fetchData);

// Export
exportBtn.addEventListener('click', () => {
  const token = localStorage.getItem('arToken');
  window.location.href = `/api/ar/export?token=${token}`;
});

// Send Mail
mailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = mailForm.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  mailMsg.style.display = 'none';

  try {
    const token = localStorage.getItem('arToken');
    const res = await fetch('/api/ar/mail', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        subject: mailSubject.value,
        body: mailBody.value
      })
    });
    
    if (res.status === 401 || res.status === 403) {
      return logoutBtn.click();
    }

    const data = await res.json();
    mailMsg.style.display = 'block';
    
    if (data.success) {
      mailMsg.textContent = data.message;
      mailMsg.style.color = 'var(--gemini-green)';
      mailSubject.value = '';
      mailBody.value = '';
    } else {
      mailMsg.textContent = data.message || 'Failed to send';
      mailMsg.style.color = 'var(--gemini-red)';
    }
  } catch (err) {
    mailMsg.style.display = 'block';
    mailMsg.textContent = 'Network error';
    mailMsg.style.color = 'var(--gemini-red)';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Mail';
  }
});

// Init
checkAuth();
