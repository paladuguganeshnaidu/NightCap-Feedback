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

const tableBody = document.getElementById('tableBody');
const refreshBtn = document.getElementById('refreshBtn');

const fetchData = async () => {
  try {
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Loading...</td></tr>';
    const res = await fetch('/api/submissions');
    const result = await res.json();
    
    if (res.ok && result.success) {
      if (result.data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No submissions yet.</td></tr>';
        return;
      }
      
      tableBody.innerHTML = result.data.map(row => `
        <tr>
          <td>${row.id}</td>
          <td style="font-family: monospace; font-weight: bold; color: var(--gemini-purple);">${row.usn}</td>
          <td>${row.name}</td>
          <td>${new Date(row.submitted_at + 'Z').toLocaleString()}</td>
        </tr>
      `).join('');
    } else {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ea4335;">Failed to load data</td></tr>`;
    }
  } catch (e) {
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ea4335;">Network Error</td></tr>`;
  }
};

refreshBtn.addEventListener('click', fetchData);

// Initial load
fetchData();
