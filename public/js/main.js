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

// Form Elements
const form = document.getElementById('feedbackForm');
const usnInput = document.getElementById('usn');
const nameInput = document.getElementById('name');
const branchTag = document.getElementById('branchTag');
const usnError = document.getElementById('usnError');
const nameError = document.getElementById('nameError');
const globalError = document.getElementById('globalError');
const submitBtn = document.getElementById('submitBtn');
const btnSpinner = document.getElementById('btnSpinner');
const btnText = submitBtn.querySelector('span');

const formContainer = document.getElementById('formContainer');
const successState = document.getElementById('successState');
const successMessage = document.getElementById('successMessage');
const redirectText = document.getElementById('redirectText');
const countdownEl = document.getElementById('countdown');

// Validation Regex
const usnRegex = /^1NC2[03456789](CS|CI|CD|IS|EC|EE|ME|CV)\d{3}$/i;
const nameRegex = /^[a-zA-Z\s\.]{1,100}$/;

// Audio blip
const playBlip = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch(e) {
    console.log('Audio disabled');
  }
};

// Real-time Validation
usnInput.addEventListener('input', (e) => {
  const val = e.target.value.toUpperCase();
  e.target.value = val;
  
  if (val.length === 0) {
    usnInput.className = '';
    branchTag.classList.remove('show');
    usnError.classList.remove('show');
    return;
  }

  const match = val.match(/^1NC2[03456789](CS|CI|CD|IS|EC|EE|ME|CV)/i);
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
  if (usnInput.value && !usnRegex.test(usnInput.value)) {
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

// Form Submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  globalError.textContent = '';
  globalError.classList.remove('show');

  const usn = usnInput.value;
  const name = nameInput.value;

  let isValid = true;
  if (!usnRegex.test(usn)) {
    usnError.classList.add('show');
    isValid = false;
  }
  if (!nameRegex.test(name)) {
    nameError.classList.add('show');
    isValid = false;
  }

  if (!isValid) return;

  // Submit
  submitBtn.disabled = true;
  btnText.style.display = 'none';
  btnSpinner.style.display = 'block';

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usn, name })
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
  successMessage.textContent = data.message;
  
  createConfetti();

  if (data.redirect_url) {
    redirectText.textContent = 'Complete Feedback for Certificate';
    redirectText.style.display = 'block';
    
    // Make the redirect text pulse beautifully
    redirectText.style.animation = 'pulseCount 1.5s infinite';
    redirectText.style.color = 'var(--gemini-purple)';
    redirectText.style.fontWeight = '600';
    redirectText.style.marginTop = '1.5rem';
    redirectText.style.fontSize = '1.2rem';
    
    if (countdownEl) countdownEl.style.display = 'none';
    
    const manualBtn = document.getElementById('manualRedirectBtn');
    if (manualBtn) {
      manualBtn.href = data.redirect_url;
      manualBtn.style.display = 'inline-flex';
    }
    
    // Redirect after 1.8 seconds (just enough time for confetti pop!)
    setTimeout(() => {
      window.location.href = data.redirect_url;
    }, 1800);
  } else {
    redirectText.textContent = 'You may close this tab.';
    redirectText.style.color = 'var(--text-color)';
    if (countdownEl) countdownEl.style.display = 'none';
  }
};
