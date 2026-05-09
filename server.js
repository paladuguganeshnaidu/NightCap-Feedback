const express = require('express');
const sqlite = require('better-sqlite3');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretgeminikey';

// DB Init
const db = new sqlite('data.db');

// Setup DB schema
db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usn TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    submitted_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
  
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
`);

// Helper to log actions
const logAction = (action, details) => {
  try {
    db.prepare('INSERT INTO logs (action, details) VALUES (?, ?)').run(action, details);
  } catch(e) {
    console.error('Log error', e);
  }
}

// Middleware
// helmet configuration to allow inline styles/scripts and assets for a simple local app setup
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const submitLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per IP
  message: { success: false, message: 'Too many requests from this IP, please try again after a minute' }
});

// Admin Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) return res.status(401).json({ success: false, message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// --- ROUTES ---

// Submit
app.post('/api/submit', submitLimiter, (req, res) => {
  const { usn, name } = req.body;
  
  if (!usn || !name) {
    return res.status(400).json({ success: false, message: 'USN and Name are required.' });
  }

  // Validate USN
  const usnRegex = /^1NC2[03456789](CS|CI|CD|IS|EC|EE|ME|CV)\d{3}$/i;
  if (!usnRegex.test(usn.toUpperCase())) {
    return res.status(400).json({ success: false, message: 'Invalid USN format.' });
  }

  // Validate Name
  const nameRegex = /^[a-zA-Z\s\.]{1,100}$/;
  if (!nameRegex.test(name)) {
    return res.status(400).json({ success: false, message: 'Invalid Name format.' });
  }

  try {
    const stmt = db.prepare('INSERT INTO submissions (usn, name) VALUES (?, ?)');
    stmt.run(usn.toUpperCase(), name.trim());
    
    // Check if there is a redirect URL
    const configRow = db.prepare("SELECT value FROM config WHERE key = 'redirect_url'").get();
    const redirectUrl = configRow ? configRow.value : null;

    res.json({ success: true, redirect_url: redirectUrl, message: 'Thank you for your submission!' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ success: false, message: "You've already submitted. Thanks!" });
    }
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// Get Submissions
app.get('/api/submissions', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM submissions ORDER BY id DESC').all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// Export CSV
app.get('/api/export', (req, res) => {
  try {
    const rows = db.prepare('SELECT usn, name, submitted_at FROM submissions ORDER BY id DESC').all();
    let csv = 'USN,Name,Submitted At\n';
    rows.forEach(row => {
      // Escape quotes
      const safeName = row.name.replace(/"/g, '""');
      csv += `"${row.usn}","${safeName}","${row.submitted_at}"\n`;
    });
    
    res.header('Content-Type', 'text/csv');
    res.attachment('submissions.csv');
    return res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Export failed.' });
  }
});

// --- ADMIN ROUTES ---

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '12h' });
    logAction('Admin Login', 'Admin successfully logged in');
    res.json({ success: true, token });
  } else {
    logAction('Admin Login Failed', 'Failed login attempt');
    res.status(401).json({ success: false, message: 'Invalid password' });
  }
});

// Get Config
app.get('/api/admin/config', authenticateToken, (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM config WHERE key = 'redirect_url'").get();
    res.json({ success: true, redirect_url: row ? row.value : '' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// Set Config
app.put('/api/admin/config', authenticateToken, (req, res) => {
  const { redirect_url } = req.body;
  try {
    const stmt = db.prepare("INSERT INTO config (key, value) VALUES ('redirect_url', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    stmt.run(redirect_url || '');
    logAction('Config Update', `Redirect URL updated to ${redirect_url}`);
    res.json({ success: true, message: 'Config updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// Clear All Data
app.delete('/api/admin/clear', authenticateToken, (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Invalid password' });
  }
  
  try {
    db.exec("DELETE FROM submissions; DELETE FROM sqlite_sequence WHERE name='submissions';");
    logAction('Clear Data', 'All submissions data was cleared');
    res.json({ success: true, message: 'All data cleared successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// Delete Single Submission
app.delete('/api/admin/submission/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  try {
    const row = db.prepare('SELECT usn FROM submissions WHERE id = ?').get(id);
    const stmt = db.prepare('DELETE FROM submissions WHERE id = ?');
    const info = stmt.run(id);
    if (info.changes > 0) {
      logAction('Delete Submission', `Deleted submission ID: ${id}, USN: ${row?.usn}`);
      res.json({ success: true, message: 'Submission deleted' });
    } else {
      res.status(404).json({ success: false, message: 'Submission not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// Get Logs
app.get('/api/admin/logs', authenticateToken, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 50').all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
