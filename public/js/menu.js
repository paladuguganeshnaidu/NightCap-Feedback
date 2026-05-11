document.addEventListener('DOMContentLoaded', () => {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const menuOverlay = document.getElementById('menuOverlay');

  if (hamburgerBtn && menuOverlay) {
    hamburgerBtn.addEventListener('click', () => {
      hamburgerBtn.classList.toggle('open');
      menuOverlay.classList.toggle('open');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (menuOverlay.classList.contains('open') && 
          !menuOverlay.contains(e.target) && 
          !hamburgerBtn.contains(e.target)) {
        hamburgerBtn.classList.remove('open');
        menuOverlay.classList.remove('open');
      }
    });
  }
});
