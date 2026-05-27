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
  welcomeName.textContent = name || localStorage.getItem('arName');
  
  const gid = localStorage.getItem('arGid') || '';
  document.getElementById('displayGid').textContent = gid;
  
  if (gid) {
    document.getElementById('specialRegLink').value = `${window.location.origin}/register?gsa=${gid}`;
    document.getElementById('specialFbLink').value = `${window.location.origin}/feedback?gsa=${gid}`;
  }

  fetchData();
  fetchFeedback();
  fetchConfig();
  fetchGsaPosts();
};

window.copyLink = (inputId, btn) => {
  const linkInput = document.getElementById(inputId);
  linkInput.select();
  document.execCommand('copy');
  const originalText = btn.textContent;
  btn.textContent = '✅ Copied!';
  setTimeout(() => btn.textContent = originalText, 2000);
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
      localStorage.setItem('arGid', gidInput.value.trim());
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
  localStorage.removeItem('arGid');
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

const fetchConfig = async () => {
  try {
    const token = localStorage.getItem('arToken');
    const res = await fetch('/api/ar/config', { headers: { 'Authorization': `Bearer ${token}` }});
    const data = await res.json();
    if (data.success) {
      document.getElementById('customRedirectUrl').value = data.redirect_url || '';
    }
  } catch(e) {}
};

const redirectForm = document.getElementById('redirectForm');
const customRedirectUrl = document.getElementById('customRedirectUrl');
const redirectMsg = document.getElementById('redirectMsg');

if (redirectForm) {
  redirectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('arToken');
    try {
      const res = await fetch('/api/ar/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ redirect_url: customRedirectUrl.value })
      });
      const data = await res.json();
      redirectMsg.style.display = 'block';
      redirectMsg.style.color = res.ok ? 'var(--gemini-green)' : 'var(--gemini-red)';
      redirectMsg.textContent = data.message || 'Action failed';
      setTimeout(() => redirectMsg.style.display = 'none', 3000);
    } catch(e) {}
  });
}

let allFeedback = [];
let showRecycleBin = false;

const fbSearchInput = document.getElementById('fbSearchInput');
const recycleBinBtn = document.getElementById('recycleBinBtn');

if (fbSearchInput) {
  fbSearchInput.addEventListener('input', () => renderFeedback());
}

if (recycleBinBtn) {
  recycleBinBtn.addEventListener('click', () => {
    showRecycleBin = !showRecycleBin;
    recycleBinBtn.textContent = showRecycleBin ? '⬅️ Back to Active' : '🗑️ Recycle Bin';
    renderFeedback();
  });
}

const renderFeedback = () => {
  const fbTableBody = document.getElementById('fbTableBody');
  const fbCount = document.getElementById('fbCount');
  if (!fbTableBody) return;

  const term = (fbSearchInput ? fbSearchInput.value : '').toLowerCase();
  
  const filtered = allFeedback.filter(r => {
    const inBin = r.is_deleted === true;
    if (showRecycleBin !== inBin) return false;
    
    if (term) {
      return (r.usn && r.usn.toLowerCase().includes(term)) ||
             (r.name && r.name.toLowerCase().includes(term)) ||
             (r.reg_id && String(r.reg_id).includes(term));
    }
    return true;
  });

  if(fbCount) fbCount.textContent = filtered.length;
  
  if (filtered.length === 0) {
    fbTableBody.innerHTML = '<tr><td colspan="12" style="text-align: center;">No feedback found.</td></tr>';
    return;
  }
  
  fbTableBody.innerHTML = filtered.map(r => `
    <tr>
      <td>#${r.reg_id || r.id}</td>
      <td style="font-weight: bold; color: var(--gemini-purple);">${r.usn}</td>
      <td>${r.name}</td>
      <td>${r.college_name || '-'}</td>
      <td>${r.year_of_study || '-'}</td>
      <td>${r.branch_major || '-'}</td>
      <td>${r.state || '-'}</td>
      <td>${r.city || '-'}</td>
      <td>${r.nano_banana_link ? `<a href="${r.nano_banana_link}" target="_blank">Link</a>` : '-'}</td>
      <td>${new Date(r.submitted_at).toLocaleString()}</td>
      <td>
        ${!r.is_deleted ? 
          `<button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-color: var(--gemini-red); color: var(--gemini-red);" onclick="deleteFeedback(${r.id})">Delete</button>` :
          `<div style="display: flex; flex-direction: column; gap: 5px;">
            <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-color: var(--gemini-green); color: var(--gemini-green);" onclick="restoreFeedback(${r.id})">Restore</button>
            <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-color: red; color: red;" onclick="permanentDeleteFeedback(${r.id})">Perm Delete</button>
          </div>`
        }
      </td>
    </tr>
  `).join('');
};

const fetchFeedback = async () => {
  const fbTableBody = document.getElementById('fbTableBody');
  if (fbTableBody) fbTableBody.innerHTML = '<tr><td colspan="12" style="text-align: center;">Loading feedback...</td></tr>';
  try {
    const token = localStorage.getItem('arToken');
    const res = await fetch('/api/ar/feedback', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      allFeedback = data.data;
      renderFeedback();
    }
  } catch (err) {
    if (fbTableBody) fbTableBody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: red;">Failed to load feedback</td></tr>';
  }
};

window.deleteFeedback = async (id) => {
  if(!confirm('Move this feedback to the recycle bin?')) return;
  try {
    const token = localStorage.getItem('arToken');
    const res = await fetch(`/api/ar/feedback/${id}/delete`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if(res.ok) fetchFeedback();
  } catch(e) {}
};

window.restoreFeedback = async (id) => {
  try {
    const token = localStorage.getItem('arToken');
    const res = await fetch(`/api/ar/feedback/${id}/restore`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if(res.ok) fetchFeedback();
  } catch(e) {}
};

window.permanentDeleteFeedback = async (id) => {
  if(!confirm('Permanently delete this feedback? This cannot be undone.')) return;
  try {
    const token = localStorage.getItem('arToken');
    const res = await fetch(`/api/ar/feedback/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if(res.ok) fetchFeedback();
  } catch(e) {}
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
      <td>#${r.reg_id || r.id}</td>
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
      <td>
        <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-color: var(--gemini-purple); color: var(--gemini-purple); margin-bottom: 5px;" onclick="editRegistration(${r.id})">Edit</button>
        <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-color: var(--gemini-red); color: var(--gemini-red);" onclick="removeRegistration(${r.id})">Remove</button>
      </td>
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

// Add/Edit Registration Logic
const addRegBtn = document.getElementById('addRegBtn');
const regModal = document.getElementById('regModal');
const closeRegModal = document.getElementById('closeRegModal');
const regForm = document.getElementById('regForm');
const regModalTitle = document.getElementById('regModalTitle');
const regId = document.getElementById('regId');
const regUsn = document.getElementById('regUsn');
const regName = document.getElementById('regName');
const regMobile = document.getElementById('regMobile');
const regEmail = document.getElementById('regEmail');
const regDept = document.getElementById('regDept');
const regError = document.getElementById('regError');

if (addRegBtn) {
  addRegBtn.addEventListener('click', () => {
    regModalTitle.textContent = 'Add Registration';
    regId.value = '';
    regUsn.value = '';
    regName.value = '';
    regMobile.value = '';
    regEmail.value = '';
    regDept.value = '';
    regError.style.display = 'none';
    regModal.style.display = 'flex';
  });
}

if (closeRegModal) {
  closeRegModal.addEventListener('click', () => {
    regModal.style.display = 'none';
  });
}

window.editRegistration = (id) => {
  const reg = currentData.find(r => r.id === id);
  if (!reg) return;
  regModalTitle.textContent = 'Edit Registration';
  regId.value = reg.id;
  regUsn.value = reg.usn;
  regName.value = reg.name;
  regMobile.value = reg.mobile;
  regEmail.value = reg.email;
  regDept.value = reg.department;
  regError.style.display = 'none';
  regModal.style.display = 'flex';
};

if (regForm) {
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    regError.style.display = 'none';
    const submitBtn = regForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    
    const payload = {
      usn: regUsn.value.trim(),
      name: regName.value.trim(),
      mobile: regMobile.value.trim(),
      email: regEmail.value.trim(),
      department: regDept.value.trim()
    };
    
    const id = regId.value;
    const url = id ? `/api/ar/registration/${id}` : '/api/ar/registration';
    const method = id ? 'PUT' : 'POST';
    
    try {
      const token = localStorage.getItem('arToken');
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        regModal.style.display = 'none';
        fetchData();
      } else {
        regError.textContent = data.message || 'Failed to save';
        regError.style.display = 'block';
      }
    } catch (err) {
      regError.textContent = 'Network Error';
      regError.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save';
    }
  });
}


refreshBtn.addEventListener('click', () => {
  fetchData();
  fetchFeedback();
});

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

const loadGlobalRegistrationCount = async () => {
  try {
    const res = await fetch('/api/public/registration-count');
    const data = await res.json();
    if (data.success) {
      document.querySelectorAll('.cube-count').forEach(el => el.textContent = data.count);
    }
  } catch(e) { console.error('Failed to load count'); }
};
loadGlobalRegistrationCount();

// --- GSA POSTS FRONTEND LOGIC ---
const postImage = document.getElementById('postImage');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
if (postImage) {
  postImage.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreviewContainer.style.display = 'block';
      };
      reader.readAsDataURL(file);
    } else {
      imagePreviewContainer.style.display = 'none';
      imagePreview.src = '';
    }
  });
}

// Helper to compress image client-side to below 2MB if it is larger, while preserving excellent clarity
const compressImage = (file, maxSize = 2 * 1024 * 1024) => {
  return new Promise((resolve, reject) => {
    if (file.size <= maxSize) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        // Scale down dimensions if they are extremely huge to preserve quality while reducing size
        const MAX_DIM = 2048;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.90;
        const step = 0.08;

        const attemptCompress = (q) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              return reject(new Error('Canvas compression failed'));
            }
            if (blob.size <= maxSize || q <= 0.3) {
              // Convert blob to a File object with a clean .jpg filename
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              attemptCompress(q - step);
            }
          }, 'image/jpeg', q);
        };

        attemptCompress(quality);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const postForm = document.getElementById('postForm');
const postCaption = document.getElementById('postCaption');
const postSpinner = document.getElementById('postSpinner');
const postMsg = document.getElementById('postMsg');

if (postForm) {
  postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    postMsg.style.display = 'none';
    
    const token = localStorage.getItem('arToken');
    const file = postImage.files[0];
    const caption = postCaption.value.trim();
    
    if (!file || !caption) {
      postMsg.style.display = 'block';
      postMsg.style.color = 'var(--gemini-red)';
      postMsg.textContent = 'Image and caption are both required.';
      return;
    }
    
    const submitBtn = postForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    if (postSpinner) postSpinner.style.display = 'inline-block';

    let fileToUpload = file;
    if (file.size > 2 * 1024 * 1024) {
      postMsg.style.display = 'block';
      postMsg.style.color = 'var(--gemini-blue)';
      postMsg.textContent = 'Optimizing image for upload...';
      try {
        fileToUpload = await compressImage(file);
      } catch (err) {
        console.error('Image compression failed, using original file:', err);
      }
    }
    
    const formData = new FormData();
    formData.append('image', fileToUpload);
    formData.append('caption', caption);
    
    try {
      // Clear optimization message and show posting status
      postMsg.style.display = 'block';
      postMsg.style.color = 'var(--text-color)';
      postMsg.textContent = 'Publishing post...';

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      let data;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      }
      
      postMsg.style.display = 'block';
      
      if (res.ok && data && data.success) {
        postMsg.style.color = 'var(--gemini-green)';
        postMsg.textContent = 'Post published successfully!';
        postForm.reset();
        if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
        if (imagePreview) imagePreview.src = '';
        fetchGsaPosts(); // Reload posts
      } else {
        postMsg.style.color = 'var(--gemini-red)';
        if (res.status === 413) {
          postMsg.textContent = 'Image file is too large (Max 2MB).';
        } else {
          postMsg.textContent = (data && data.message) || `Failed to publish post (Status ${res.status}).`;
        }
      }
    } catch (err) {
      postMsg.style.display = 'block';
      postMsg.style.color = 'var(--gemini-red)';
      postMsg.textContent = 'Connection error while publishing post. Please check the file size and try again.';
    } finally {
      submitBtn.disabled = false;
      if (postSpinner) postSpinner.style.display = 'none';
    }
  });
}

const fetchGsaPosts = async () => {
  const gsaPostsList = document.getElementById('gsaPostsList');
  if (!gsaPostsList) return;
  
  gsaPostsList.innerHTML = '<div style="text-align: center; grid-column: 1/-1; opacity: 0.6; padding: 2rem 0;">Loading your posts...</div>';
  
  try {
    const token = localStorage.getItem('arToken');
    const res = await fetch('/api/ar/posts', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (data.success && data.data.length > 0) {
      gsaPostsList.innerHTML = data.data.map(post => `
        <div class="glass" style="border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
          <div style="width: 100%; padding-top: 56.25%; position: relative; background: rgba(0,0,0,0.1);">
            <img src="${post.image_path}" alt="Post image" style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit: cover;">
          </div>
          <div style="padding: 1rem; display: flex; flex-direction: column; flex-grow: 1;">
            <p style="font-size: 0.9rem; margin-bottom: 1rem; flex-grow: 1; white-space: pre-wrap; line-height: 1.5; color: var(--text-color);">${post.caption}</p>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 0.8rem; margin-top: auto;">
              <span style="font-size: 0.75rem; opacity: 0.6;">${new Date(post.created_at).toLocaleDateString()}</span>
              <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-color: var(--gemini-red); color: var(--gemini-red); border-radius: 6px;" onclick="deleteGsaPost(${post.id})">Delete</button>
            </div>
          </div>
        </div>
      `).join('');
    } else {
      gsaPostsList.innerHTML = '<div style="text-align: center; grid-column: 1/-1; opacity: 0.6; padding: 2rem 0;">You haven\'t published any posts yet.</div>';
    }
  } catch (err) {
    gsaPostsList.innerHTML = '<div style="text-align: center; grid-column: 1/-1; color: var(--gemini-red); padding: 2rem 0;">Failed to load posts.</div>';
  }
};

window.deleteGsaPost = async (id) => {
  if (!confirm('Are you sure you want to delete this post? This will remove it from the public feed.')) return;
  const token = localStorage.getItem('arToken');
  try {
    const res = await fetch(`/api/posts/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      fetchGsaPosts();
    } else {
      alert(data.message || 'Failed to delete post.');
    }
  } catch (err) {
    alert('Network error while deleting post.');
  }
};
