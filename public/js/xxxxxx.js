const themeToggle = document.getElementById('themeToggle');
const currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);

themeToggle.addEventListener('click', () => {
  let theme = document.documentElement.getAttribute('data-theme');
  let newTheme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
});

const loginContainer = document.getElementById('loginContainer');
const dashboardContainer = document.getElementById('dashboardContainer');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

const adminForm = document.getElementById('adminForm');
const formTitle = document.getElementById('formTitle');
const editId = document.getElementById('editId');
const adminGid = document.getElementById('adminGid');
const adminName = document.getElementById('adminName');
const adminPassword = document.getElementById('adminPassword');
const adminMax = document.getElementById('adminMax');
const adminLanguage = document.getElementById('adminLanguage');
const saveBtn = document.getElementById('saveBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formMsg = document.getElementById('formMsg');
const tableBody = document.getElementById('tableBody');

const checkAuth = () => {
  const token = localStorage.getItem('superToken');
  if (token) {
    showDashboard();
  } else {
    showLogin();
  }
};

const showLogin = () => {
  loginContainer.style.display = 'flex';
  dashboardContainer.style.display = 'none';
  logoutBtn.style.display = 'none';
};

const showDashboard = () => {
  loginContainer.style.display = 'none';
  dashboardContainer.style.display = 'block';
  logoutBtn.style.display = 'block';
  fetchAdmins();
};

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.remove('show');
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.value })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      localStorage.setItem('superToken', data.token);
      showDashboard();
    } else {
      loginError.textContent = 'Invalid Master Password';
      loginError.classList.add('show');
    }
  } catch (err) {
    loginError.textContent = 'Network error';
    loginError.classList.add('show');
  }
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('superToken');
  showLogin();
});

let adminsList = [];

const fetchAdmins = async () => {
  const token = localStorage.getItem('superToken');
  try {
    const res = await fetch('/api/super/admins', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) return logoutBtn.click();
    const data = await res.json();
    if (data.success) {
      adminsList = data.data;
      renderTable();
    }
  } catch (e) {
    tableBody.innerHTML = '<tr><td colspan="6">Failed to load data</td></tr>';
  }
};

const renderTable = () => {
  if (adminsList.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No admins found.</td></tr>';
    return;
  }
  tableBody.innerHTML = adminsList.map(a => `
    <tr>
      <td>${a.id}</td>
      <td style="font-weight: 600; color: var(--gemini-purple);">${a.gid}</td>
      <td>${a.name}</td>
      <td>${a.password}</td>
      <td>${a.max_count}</td>
      <td>${a.language || 'English'}</td>
      <td>
        <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="editAdmin(${a.id})">Edit</button>
        <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-color: var(--gemini-red); color: var(--gemini-red);" onclick="deleteAdmin(${a.id})">Del</button>
      </td>
    </tr>
  `).join('');
};

window.editAdmin = (id) => {
  const admin = adminsList.find(a => a.id === id);
  if (!admin) return;
  editId.value = admin.id;
  adminGid.value = admin.gid;
  adminName.value = admin.name;
  adminPassword.value = admin.password;
  adminMax.value = admin.max_count;
  adminLanguage.value = admin.language || 'English';
  formTitle.textContent = 'Edit Admin';
  cancelEditBtn.style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

cancelEditBtn.addEventListener('click', () => {
  editId.value = '';
  adminForm.reset();
  formTitle.textContent = 'Add New Admin';
  cancelEditBtn.style.display = 'none';
  formMsg.style.display = 'none';
});

adminForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('superToken');
  const payload = {
    gid: adminGid.value,
    name: adminName.value,
    password: adminPassword.value,
    max_count: parseInt(adminMax.value),
    language: adminLanguage.value
  };
  
  const isEdit = editId.value !== '';
  const url = isEdit ? `/api/super/admins/${editId.value}` : '/api/super/admins';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    formMsg.style.display = 'block';
    if (res.ok && data.success) {
      formMsg.textContent = data.message;
      formMsg.style.color = 'var(--gemini-green)';
      cancelEditBtn.click(); // resets form
      fetchAdmins();
    } else {
      formMsg.textContent = data.message || 'Action failed';
      formMsg.style.color = 'var(--gemini-red)';
    }
  } catch(err) {
    formMsg.style.display = 'block';
    formMsg.textContent = 'Network error';
    formMsg.style.color = 'var(--gemini-red)';
  }
});

window.deleteAdmin = async (id) => {
  if (!confirm('Are you sure you want to delete this admin?')) return;
  const token = localStorage.getItem('superToken');
  try {
    const res = await fetch(`/api/super/admins/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) fetchAdmins();
  } catch(err) { alert('Error deleting'); }
};

checkAuth();
