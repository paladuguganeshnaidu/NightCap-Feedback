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
const adminStatus = document.getElementById('adminStatus');
const saveBtn = document.getElementById('saveBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formMsg = document.getElementById('formMsg');
const tableBody = document.getElementById('tableBody');

const superConfigForm = document.getElementById('superConfigForm');
const allowedBranchesInput = document.getElementById('allowedBranches');
const superConfigMsg = document.getElementById('superConfigMsg');

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
  fetchConfig();
  fetchAdmins();
  fetchAllRegistrations();
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

const fetchConfig = async () => {
  const token = localStorage.getItem('superToken');
  try {
    const res = await fetch('/api/admin/config', { headers: { 'Authorization': `Bearer ${token}` }});
    const data = await res.json();
    if (data.success && allowedBranchesInput) {
      allowedBranchesInput.value = data.allowed_branches || 'CS,CI,CD,IS,EC,EE,ME,CV';
    }
  } catch(e) {}
};

if (superConfigForm) {
  superConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('superToken');
    const branches = allowedBranchesInput.value;
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ allowed_branches: branches })
      });
      if (res.ok) {
        superConfigMsg.style.display = 'block';
        setTimeout(() => superConfigMsg.style.display = 'none', 3000);
      }
    } catch(e) {}
  });
}

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
    tableBody.innerHTML = '<tr><td colspan="10">Failed to load data</td></tr>';
  }
};

const renderTable = () => {
  if (adminsList.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">No admins found.</td></tr>';
    return;
  }
  tableBody.innerHTML = adminsList.map(a => `
    <tr>
      <td>${a.id}</td>
      <td style="font-weight: 600; color: var(--gemini-purple);">${a.gid}</td>
      <td>${a.name}</td>
      <td>${a.password}</td>
      <td>${a.max_count}</td>
      <td style="font-weight: bold; color: ${parseInt(a.current_count) >= a.max_count ? 'var(--gemini-red)' : 'var(--gemini-green)'};">${a.current_count}</td>
      <td>${a.language || 'English'}</td>
      <td>
        <span style="color: ${a.is_active !== false ? 'var(--gemini-green)' : 'var(--gemini-red)'}; font-weight: bold;">
          ${a.is_active !== false ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <div style="display:flex; flex-direction:column; gap:0.4rem;">
          <input type="text" readonly value="${window.location.origin}/register?gsa=${a.gid}" style="font-size:0.75rem; padding:0.3rem; border-radius:4px; border:1px solid #555; background:rgba(0,0,0,0.3); color:white; cursor:pointer;" onclick="this.select();document.execCommand('copy');alert('Registration Link Copied!')" title="Click to copy Reg Link">
          <input type="text" readonly value="${window.location.origin}/feedback?gsa=${a.gid}" style="font-size:0.75rem; padding:0.3rem; border-radius:4px; border:1px solid #555; background:rgba(0,0,0,0.3); color:white; cursor:pointer;" onclick="this.select();document.execCommand('copy');alert('Feedback Link Copied!')" title="Click to copy Feedback Link">
        </div>
      </td>
      <td>
        <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-bottom: 0.2rem;" onclick="editAdmin(${a.id})">Edit</button>
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
  adminStatus.value = admin.is_active !== false ? 'true' : 'false';
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
    language: adminLanguage.value,
    is_active: adminStatus.value === 'true'
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

// Clear Data functionality
const clearFeedbackBtn = document.getElementById('clearFeedbackBtn');
const clearRegistrationsBtn = document.getElementById('clearRegistrationsBtn');
const dataMsg = document.getElementById('dataMsg');

if (clearFeedbackBtn) {
  clearFeedbackBtn.addEventListener('click', async () => {
    if (!confirm('WARNING: This will permanently delete ALL feedback submissions from the cloud database. Type "CONFIRM" to proceed.') || prompt('Type CONFIRM to delete all feedback:') !== 'CONFIRM') return;
    const token = localStorage.getItem('superToken');
    try {
      const res = await fetch('/api/super/clear-feedback', { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      dataMsg.style.display = 'block';
      dataMsg.style.color = res.ok ? 'var(--gemini-green)' : 'var(--gemini-red)';
      dataMsg.textContent = data.message || 'Action failed';
      setTimeout(() => dataMsg.style.display = 'none', 4000);
    } catch(e) {}
  });
}

if (clearRegistrationsBtn) {
  clearRegistrationsBtn.addEventListener('click', async () => {
    if (!confirm('WARNING: This will permanently delete ALL user registrations from the cloud database. Type "CONFIRM" to proceed.') || prompt('Type CONFIRM to delete all registrations:') !== 'CONFIRM') return;
    const token = localStorage.getItem('superToken');
    try {
      const res = await fetch('/api/super/clear-registrations', { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      dataMsg.style.display = 'block';
      dataMsg.style.color = res.ok ? 'var(--gemini-green)' : 'var(--gemini-red)';
      dataMsg.textContent = data.message || 'Action failed';
      setTimeout(() => dataMsg.style.display = 'none', 4000);
    } catch(e) {}
  });
}

// All Registrations grouping logic
const allRegistrationsContainer = document.getElementById('allRegistrationsContainer');
const refreshRegsBtn = document.getElementById('refreshRegsBtn');

const fetchAllRegistrations = async () => {
  const token = localStorage.getItem('superToken');
  try {
    if (allRegistrationsContainer) allRegistrationsContainer.innerHTML = '<p style="text-align: center;">Loading registrations...</p>';
    const res = await fetch('/api/super/all-registrations', { headers: { 'Authorization': `Bearer ${token}` }});
    const data = await res.json();
    if (data.success) {
      renderAllRegistrations(data.data);
    } else {
      if (allRegistrationsContainer) allRegistrationsContainer.innerHTML = '<p style="color: var(--gemini-red); text-align: center;">Failed to load registrations.</p>';
    }
  } catch(e) {
    if (allRegistrationsContainer) allRegistrationsContainer.innerHTML = '<p style="color: var(--gemini-red); text-align: center;">Error loading registrations.</p>';
  }
};

const renderAllRegistrations = (registrations) => {
  if (!allRegistrationsContainer) return;
  if (registrations.length === 0) {
    allRegistrationsContainer.innerHTML = '<p style="text-align: center;">No registrations found yet.</p>';
    return;
  }

  // Group by admin_gid
  const grouped = {};
  registrations.forEach(r => {
    const key = r.admin_name ? `${r.admin_name} (${r.admin_gid})` : `GSA ${r.admin_gid}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  let html = '';
  for (const [gsa, regs] of Object.entries(grouped)) {
    html += `
      <div style="margin-top: 1.5rem; background: rgba(0,0,0,0.02); border-radius: 8px; padding: 1rem; border: 1px solid var(--border-color);">
        <h3 style="color: var(--gemini-purple); margin-bottom: 1rem; border-bottom: 2px solid var(--border-color); padding-bottom: 0.5rem;">${gsa} <span style="font-size: 0.9rem; color: var(--text-color); opacity: 0.7;">(${regs.length} registrations)</span></h3>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Reg ID</th>
                <th>Name</th>
                <th>USN</th>
                <th>Dept</th>
                <th>Mobile</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              ${regs.map(r => `
                <tr>
                  <td style="font-weight: bold;">${r.reg_id}</td>
                  <td>${r.name}</td>
                  <td>${r.usn}</td>
                  <td>${r.department}</td>
                  <td>${r.mobile}</td>
                  <td>${r.email}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  allRegistrationsContainer.innerHTML = html;
};

if (refreshRegsBtn) {
  refreshRegsBtn.addEventListener('click', fetchAllRegistrations);
}
