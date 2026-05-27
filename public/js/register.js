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

// Form Elements
const form = document.getElementById('registrationForm');
const usnInput = document.getElementById('usn');
const nameInput = document.getElementById('name');
const mobileInput = document.getElementById('mobile');
const emailInput = document.getElementById('email');
const notNcetStudentCheckbox = document.getElementById('notNcetStudent');

const branchTag = document.getElementById('branchTag');
const usnError = document.getElementById('usnError');
const nameError = document.getElementById('nameError');
const mobileError = document.getElementById('mobileError');
const globalError = document.getElementById('globalError');

const submitBtn = document.getElementById('submitBtn');
const btnSpinner = document.getElementById('btnSpinner');
const btnText = submitBtn.querySelector('span');

const formContainer = document.getElementById('formContainer');
const successState = document.getElementById('successState');
const assignedAdminText = document.getElementById('assignedAdminText');
const adminChoiceSelect = document.getElementById('adminChoice');

if (notNcetStudentCheckbox) {
  notNcetStudentCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      usnInput.removeAttribute('required');
      usnInput.value = '';
      branchTag.classList.remove('show');
      usnError.classList.remove('show');
      usnInput.classList.remove('valid', 'invalid');
    } else {
      usnInput.setAttribute('required', 'required');
    }
  });
}

const loadAdmins = async () => {
  const languageChoiceSelect = document.getElementById('languageChoice');
  if (!languageChoiceSelect) return;
  try {
    const res = await fetch('/api/admins');
    const data = await res.json();
    if (data.success) {
      window.adminData = data.data;
      
      // Extract unique languages
      const languages = [...new Set(data.data.map(a => a.language || 'English'))];
      languages.forEach(lang => {
        const opt = document.createElement('option');
        opt.value = lang;
        opt.textContent = lang;
        opt.style.color = 'black';
        languageChoiceSelect.appendChild(opt);
      });

      // Check URL for pre-selected admin (bypasses language choice)
      const urlParams = new URLSearchParams(window.location.search);
      const preselect = urlParams.get('gsa');
      if (preselect) {
        // Create a hidden input for adminChoice
        const hiddenAdmin = document.createElement('input');
        hiddenAdmin.type = 'hidden';
        hiddenAdmin.id = 'adminChoice';
        hiddenAdmin.value = preselect;
        document.getElementById('registrationForm').appendChild(hiddenAdmin);
        
        languageChoiceSelect.closest('.input-group').style.display = 'none'; // hide language
        languageChoiceSelect.removeAttribute('required'); // Prevent HTML5 validation from blocking hidden select
        
        const gsaNameDisplay = document.getElementById('gsaNameDisplay');
        if (gsaNameDisplay) {
          const adminObj = data.data.find(a => a.gid === preselect);
          if (adminObj) gsaNameDisplay.textContent = `Assigned to GSA: ${adminObj.name}`;
        }
      }
    }
  } catch(e) { console.error('Failed to load admins'); }
};
loadAdmins();

const loadRegistrationCount = async () => {
  try { const res = await fetch('/api/public/registration-count'); const data = await res.json(); if (data.success) { document.querySelectorAll('.cube-count').forEach(el => el.textContent = data.count); } } catch(e) { console.error('Failed to load count'); }
};
loadRegistrationCount();

// Validation Regex
const usnRegex = /^1NC\d{2}([A-Z]{2,3})\d{2,3}$/i;
const nameRegex = /^[a-zA-Z\s\.]{1,100}$/;
const mobileRegex = /^[0-9]{10}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const playBlip = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch(e) { }
};

// Real-time Validation
usnInput.addEventListener('input', (e) => {
  const val = e.target.value.toUpperCase().replace(/\s+/g, '');
  e.target.value = val;
  
  const isNotNcet = notNcetStudentCheckbox && notNcetStudentCheckbox.checked;
  if (isNotNcet) {
    usnInput.className = '';
    branchTag.classList.remove('show');
    usnError.classList.remove('show');
    return;
  }
  
  if (val.length === 0) {
    usnInput.className = '';
    branchTag.classList.remove('show');
    usnError.classList.remove('show');
    return;
  }

  const match = val.match(/^1NC\d{2}([A-Z]{2,3})/i);
  if (match) {
    branchTag.textContent = match[1].toUpperCase();
    branchTag.classList.add('show');
  } else {
    branchTag.classList.remove('show');
  }

  if (usnRegex.test(val)) {
    usnInput.classList.remove('invalid');
    usnInput.classList.add('valid');
    usnError.classList.remove('show');
  } else {
    usnInput.classList.remove('valid');
    usnInput.classList.add('invalid');
  }
});

usnInput.addEventListener('blur', () => {
  const isNotNcet = notNcetStudentCheckbox && notNcetStudentCheckbox.checked;
  if (isNotNcet) return;
  
  const val = usnInput.value.replace(/\s+/g, '');
  if (val && !usnRegex.test(val)) {
    usnError.classList.add('show');
  }
});

nameInput.addEventListener('input', (e) => {
  const val = e.target.value;
  if (val.length === 0) {
    nameInput.className = '';
    nameError.classList.remove('show');
    return;
  }
  if (nameRegex.test(val)) {
    nameInput.classList.remove('invalid');
    nameInput.classList.add('valid');
    nameError.classList.remove('show');
  } else {
    nameInput.classList.remove('valid');
    nameInput.classList.add('invalid');
  }
});

mobileInput.addEventListener('input', (e) => {
  const val = e.target.value;
  if (val.length === 0) {
    mobileInput.className = '';
    mobileError.classList.remove('show');
    return;
  }
  if (mobileRegex.test(val)) {
    mobileInput.classList.remove('invalid');
    mobileInput.classList.add('valid');
    mobileError.classList.remove('show');
  } else {
    mobileInput.classList.remove('valid');
    mobileInput.classList.add('invalid');
  }
});

// Confetti logic
const createConfetti = () => {
  const canvas = document.getElementById('confetti-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const colors = ['#4285F4', '#9b72cb', '#34a853', '#fbbc05', '#ea4335'];

  for (let i = 0; i < 100; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 10 + 5,
      h: Math.random() * 10 + 5,
      c: colors[Math.floor(Math.random() * colors.length)],
      v: Math.random() * 3 + 2,
      r: Math.random() * 360,
      rv: Math.random() * 5 - 2.5
    });
  }

  const render = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;
    pieces.forEach(p => {
      p.y += p.v;
      p.r += p.rv;
      if (p.y < canvas.height) active = true;
      
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.r * Math.PI / 180);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    if (active) requestAnimationFrame(render);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  render();
};

const showSuccess = (data) => {
  formContainer.style.display = 'none';
  successState.classList.add('show');
  document.getElementById('successMessage').textContent = 'Registration Successful!';
  assignedAdminText.innerHTML = `<span style="color: var(--gemini-purple); font-weight: bold; font-size: 1.1rem;">${data.message.replace('Successfully registered! ', '')}</span><br><br>We will get back soon.<br><span style="font-size: 0.9rem; opacity: 0.8; font-weight: normal;">Check confirmation mail in inbox & spam</span>`;
  
  createConfetti();
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  globalError.textContent = '';
  globalError.classList.remove('show');

  const usn = usnInput.value.replace(/\s+/g, '');
  const name = nameInput.value;
  const mobile = mobileInput.value;
  const email = emailInput.value;
  const adminChoice = document.getElementById('adminChoice') ? document.getElementById('adminChoice').value : '';
  const languageChoiceSelect = document.getElementById('languageChoice');
  const languageChoice = languageChoiceSelect && languageChoiceSelect.closest('.input-group').style.display !== 'none' ? languageChoiceSelect.value : '';

  const isNotNcet = notNcetStudentCheckbox && notNcetStudentCheckbox.checked;

  let isValid = true;
  if (!isNotNcet) {
    if (!usnRegex.test(usn)) { usnError.classList.add('show'); isValid = false; }
  } else {
    usnError.classList.remove('show');
  }
  
  if (!nameRegex.test(name)) { nameError.classList.add('show'); isValid = false; }
  if (!mobileRegex.test(mobile)) { mobileError.classList.add('show'); isValid = false; }
  if (!emailRegex.test(email)) { 
    globalError.textContent = 'Please enter a valid email address.';
    globalError.classList.add('show');
    isValid = false;
  }
  
  if (!adminChoice && !languageChoice) {
    globalError.textContent = 'Please select a language.';
    globalError.classList.add('show');
    isValid = false;
  }

  if (!isValid) return;

  submitBtn.disabled = true;
  btnText.style.display = 'none';
  btnSpinner.style.display = 'block';

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usn, name, mobile, email, adminChoice, languageChoice })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      playBlip();
      showSuccess(data);
    } else {
      globalError.textContent = data.message || 'An error occurred.';
      globalError.classList.add('show');
      submitBtn.disabled = false;
      btnText.style.display = 'block';
      btnSpinner.style.display = 'none';
    }
  } catch (err) {
    globalError.textContent = 'Network error. Please try again.';
    globalError.classList.add('show');
    submitBtn.disabled = false;
    btnText.style.display = 'block';
    btnSpinner.style.display = 'none';
  }
});

const languageChoiceSelectNode = document.getElementById('languageChoice');
if (languageChoiceSelectNode) {
  languageChoiceSelectNode.addEventListener('change', async (e) => {
    const lang = e.target.value;
    const gsaNameDisplay = document.getElementById('gsaNameDisplay');
    if (!gsaNameDisplay || !lang) return;
    try {
      const res = await fetch('/api/public/preview-gsa?lang=' + encodeURIComponent(lang));
      const data = await res.json();
      if (data.success) {
        gsaNameDisplay.textContent = 'Assigned to GSA: ' + data.name;
        gsaNameDisplay.style.color = 'var(--gemini-green)';
      } else {
        gsaNameDisplay.textContent = 'Sorry, slots are full for this language.';
        gsaNameDisplay.style.color = 'var(--gemini-red)';
      }
    } catch(err) {
      gsaNameDisplay.textContent = '';
    }
  });
}
