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
const gidInput = document.getElementById('gid');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

const headerAdminName = document.getElementById('headerAdminName');
const welcomeName = document.getElementById('welcomeName');

const tableBody = document.getElementById('tableBody');
const refreshBtn = document.getElementById('refreshBtn');
const exportBtn = document.getElementById('exportBtn');
const regCount = document.getElementById('regCount');
const searchInput = document.getElementById('searchInput');

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
      body: JSON.stringify({ gid: gidInput.value.trim(), password: passwordInput.value.trim() })
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
let currentData = [];

const fetchData = async () => {
  tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Loading data...</td></tr>';
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
      currentData = data.data;
      renderTable(currentData);
      regCount.textContent = currentData.length;
    }
  } catch (err) {
    tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: red;">Failed to load data</td></tr>';
  }
};

const renderTable = (rows) => {
  if (rows.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No registrations found.</td></tr>';
    return;
  }
  
  tableBody.innerHTML = rows.map(r => {
    // Basic WhatsApp link formatter (assumes Indian numbers for college event, adds 91 prefix if exactly 10 digits)
    const waNumber = r.mobile.length === 10 ? `91${r.mobile}` : r.mobile;
    const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(`Hi ${r.name}, this is from Fun Night with Gemini!`)}`;
    
    return `
    <tr>
      <td>#${r.id}</td>
      <td style="font-weight: 600;">${r.usn}</td>
      <td>${r.name}</td>
      <td>
        <a href="${waLink}" target="_blank" style="color: #25D366; text-decoration: none; font-weight: bold; display: flex; align-items: center; gap: 0.3rem;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          ${r.mobile}
        </a>
      </td>
      <td>${r.email}</td>
      <td><span class="branch-tag show" style="position: static; transform: none; display: inline-block;">${r.department}</span></td>
      <td style="font-size: 0.85rem; opacity: 0.8;">${new Date(r.registered_at).toLocaleString()}</td>
      <td><button class="btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; border-color: var(--gemini-red); color: var(--gemini-red);" onclick="removeRegistration(${r.id})">Remove</button></td>
    </tr>
    `;
  }).join('');
};

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = currentData.filter(r => 
      r.name.toLowerCase().includes(term) || 
      r.usn.toLowerCase().includes(term) ||
      r.mobile.includes(term)
    );
    renderTable(filtered);
  });
}

window.removeRegistration = async (id) => {
  if (!confirm('Are you sure you want to remove this registration?')) return;
  const token = localStorage.getItem('arToken');
  try {
    const res = await fetch(`/api/ar/registration/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      fetchData(); // Refresh the table
    } else {
      alert(data.message || 'Failed to remove registration');
    }
  } catch (err) {
    alert('Network error');
  }
};

refreshBtn.addEventListener('click', fetchData);

// Export
exportBtn.addEventListener('click', () => {
  const token = localStorage.getItem('arToken');
  window.location.href = `/api/ar/export?token=${token}`;
});

// Send Mail
mailForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  if (currentData.length === 0) {
    mailMsg.style.display = 'block';
    mailMsg.textContent = 'No registered members found.';
    mailMsg.style.color = 'var(--gemini-red)';
    return;
  }

  const emails = currentData.map(r => r.email).filter(e => e).join(',');
  if (!emails) {
    mailMsg.style.display = 'block';
    mailMsg.textContent = 'No email addresses found.';
    mailMsg.style.color = 'var(--gemini-red)';
    return;
  }

  const subject = encodeURIComponent(mailSubject.value);
  const body = encodeURIComponent(mailBody.value);
  
  // Construct Gmail web compose URL with Bcc
  const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${emails}&su=${subject}&body=${body}`;
  
  // Open in new tab
  window.open(gmailLink, '_blank');

  mailMsg.style.display = 'block';
  mailMsg.textContent = 'Opened Gmail compose window!';
  mailMsg.style.color = 'var(--gemini-green)';
});

// Init
checkAuth();
