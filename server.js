const express = require('express');
const sqlite = require('better-sqlite3');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');

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
  
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usn TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    email TEXT NOT NULL,
    department TEXT NOT NULL,
    admin_gid TEXT NOT NULL,
    registered_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
  
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    max_count INTEGER DEFAULT 30
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

// Seed admins if empty
try {
  const count = db.prepare('SELECT COUNT(*) as count FROM admins').get().count;
  if (count === 0) {
    const insertAdmin = db.prepare('INSERT INTO admins (gid, name, password, max_count) VALUES (?, ?, ?, ?)');
    insertAdmin.run('3082', 'Ganesh', 'Admin1', 30);
    insertAdmin.run('0000', 'Deekshitha R', 'Admin 2', 30);
    insertAdmin.run('2633', 'Aadya', 'Admin3', 30);
    insertAdmin.run('2579', 'Amrutha gowri', 'Admin3', 30);
    insertAdmin.run('2634', 'Deekshitha G S', 'Admin 4', 30);
  }
} catch (e) {
  console.error('Failed to seed admins', e);
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

// Removed hardcoded ADMIN_LIST

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

// --- NEW REGISTRATION ROUTES ---
app.post('/api/register', submitLimiter, (req, res) => {
  const { usn, name, mobile, email, adminChoice } = req.body;
  if (!usn || !name || !mobile || !email) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  const usnRegex = /^1NC2[03456789](CS|CI|CD|IS|EC|EE|ME|CV)\d{3}$/i;
  const match = usn.toUpperCase().match(usnRegex);
  if (!match) return res.status(400).json({ success: false, message: 'Invalid USN format.' });
  
  const department = match[1].toUpperCase();

  try {
    let assignedGid = null;
    let chosenAdmin = null;
    
    // If user explicitly chose an admin
    if (adminChoice && adminChoice !== "") {
      chosenAdmin = db.prepare('SELECT * FROM admins WHERE gid = ?').get(adminChoice);
      if (chosenAdmin) {
        const count = db.prepare('SELECT COUNT(*) as count FROM registrations WHERE admin_gid = ?').get(chosenAdmin.gid).count;
        if (count < chosenAdmin.max_count) {
          assignedGid = chosenAdmin.gid;
        } else {
          return res.status(400).json({ success: false, message: `Admin ${chosenAdmin.name} has reached the max limit. Please choose another or select Random.` });
        }
      }
    }

    // If no explicit choice or Random, auto-assign
    if (!assignedGid) {
      let minCount = 31; // More than max
      
      const adminList = db.prepare('SELECT * FROM admins ORDER BY id ASC').all();
      // Find the admin with the minimum registrations, preferring the original order if tied
      for (const admin of adminList) {
        const count = db.prepare('SELECT COUNT(*) as count FROM registrations WHERE admin_gid = ?').get(admin.gid).count;
        if (count < admin.max_count && count < minCount) {
          minCount = count;
          assignedGid = admin.gid;
        }
      }
    }

    if (!assignedGid) {
      return res.status(400).json({ success: false, message: 'Registration is full. No available slots.' });
    }

    const adminInfo = db.prepare('SELECT * FROM admins WHERE gid = ?').get(assignedGid);

    const stmt = db.prepare('INSERT INTO registrations (usn, name, mobile, email, department, admin_gid) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(usn.toUpperCase(), name.trim(), mobile.trim(), email.trim(), department, assignedGid);

    res.json({ success: true, message: `Successfully registered! Assigned Admin: ${adminInfo.name} (${assignedGid})` });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ success: false, message: "This USN is already registered." });
    }
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// --- AR ADMIN ROUTES ---
app.post('/api/ar/login', (req, res) => {
  const { gid, password } = req.body;
  const adminInfo = db.prepare('SELECT * FROM admins WHERE gid = ? AND password = ?').get(gid, password);
  
  if (adminInfo) {
    const token = jwt.sign({ gid: adminInfo.gid, name: adminInfo.name }, JWT_SECRET, { expiresIn: '12h' });
    logAction('AR Login', `AR Admin ${adminInfo.name} (${gid}) logged in`);
    res.json({ success: true, token, name: adminInfo.name });
  } else {
    res.status(401).json({ success: false, message: 'Invalid GID or Password' });
  }
});

const authenticateARToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) return res.status(401).json({ success: false, message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err || !user.gid) return res.status(403).json({ success: false, message: 'Invalid token' });
    req.user = user;
    next();
  });
};

app.get('/api/ar/registrations', authenticateARToken, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM registrations WHERE admin_gid = ? ORDER BY id DESC').all(req.user.gid);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

app.get('/api/ar/export', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).send('No token provided');
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err || !user.gid) return res.status(403).send('Invalid token');
    
    try {
      const rows = db.prepare('SELECT usn, name, mobile, email, department, registered_at FROM registrations WHERE admin_gid = ? ORDER BY id DESC').all(user.gid);
      let csv = 'USN,Name,Mobile,Email,Department,Registered At\n';
      rows.forEach(row => {
        const safeName = row.name.replace(/"/g, '""');
        csv += `"${row.usn}","${safeName}","${row.mobile}","${row.email}","${row.department}","${row.registered_at}"\n`;
      });
      
      res.header('Content-Type', 'text/csv');
      res.attachment(`registrations_${user.gid}.csv`);
      return res.send(csv);
    } catch (dbErr) {
      res.status(500).send('Export failed');
    }
  });
});

app.post('/api/ar/mail', authenticateARToken, async (req, res) => {
  const { subject, body } = req.body;
  if (!subject || !body) return res.status(400).json({ success: false, message: 'Subject and body are required' });

  try {
    const rows = db.prepare('SELECT email FROM registrations WHERE admin_gid = ?').all(req.user.gid);
    const emails = rows.map(r => r.email).filter(e => e);
    
    if (emails.length === 0) return res.status(400).json({ success: false, message: 'No registered members with emails found' });

    // Try to get SMTP config from env, or mock it
    const smtpHost = process.env.SMTP_HOST || 'smtp.ethereal.email';
    const smtpPort = process.env.SMTP_PORT || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      // Simulate if not configured
      console.log(`[Mock Mail] Sent to ${emails.length} users. Subject: ${subject}`);
      return res.json({ success: true, message: `(Mock Mode) Sent mock email to ${emails.length} users. Setup SMTP in .env for real emails.` });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      auth: { user: smtpUser, pass: smtpPass }
    });

    // Send emails in bcc or individually. For simplicity, send via bcc
    await transporter.sendMail({
      from: '"Fun Night with Gemini" <no-reply@funnight.com>',
      bcc: emails.join(', '),
      subject: subject,
      text: body
    });

    logAction('AR Email Sent', `Admin ${req.user.gid} sent email to ${emails.length} users`);
    res.json({ success: true, message: `Successfully sent email to ${emails.length} users.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to send emails.' });
  }
});

// Delete Registration (Admin only)
app.delete('/api/ar/registration/:id', authenticateARToken, (req, res) => {
  const id = req.params.id;
  try {
    const stmt = db.prepare('DELETE FROM registrations WHERE id = ? AND admin_gid = ?');
    const info = stmt.run(id, req.user.gid);
    
    if (info.changes > 0) {
      logAction('Delete Registration', `AR Admin ${req.user.gid} deleted registration ID: ${id}`);
      res.json({ success: true, message: 'Registration removed successfully.' });
    } else {
      res.status(404).json({ success: false, message: 'Registration not found or you do not have permission to delete it.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// --- PUBLIC ROUTE TO FETCH ADMINS ---
app.get('/api/admins', (req, res) => {
  try {
    const rows = db.prepare('SELECT gid, name, max_count FROM admins ORDER BY id ASC').all();
    res.json({ success: true, data: rows });
  } catch(e) {
    res.status(500).json({ success: false });
  }
});

// --- SUPER ADMIN ROUTES TO MANAGE AR ADMINS ---
app.get('/api/super/admins', authenticateToken, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM admins ORDER BY id ASC').all();
    res.json({ success: true, data: rows });
  } catch(e) { res.status(500).json({ success: false }); }
});

app.post('/api/super/admins', authenticateToken, (req, res) => {
  const { gid, name, password, max_count } = req.body;
  try {
    db.prepare('INSERT INTO admins (gid, name, password, max_count) VALUES (?, ?, ?, ?)').run(gid, name, password, max_count || 30);
    res.json({ success: true, message: 'Admin added successfully' });
  } catch(e) { res.status(500).json({ success: false, message: 'GID already exists or invalid data' }); }
});

app.put('/api/super/admins/:id', authenticateToken, (req, res) => {
  const { gid, name, password, max_count } = req.body;
  try {
    db.prepare('UPDATE admins SET gid=?, name=?, password=?, max_count=? WHERE id=?').run(gid, name, password, max_count, req.params.id);
    res.json({ success: true, message: 'Admin updated successfully' });
  } catch(e) { res.status(500).json({ success: false, message: 'Database error' }); }
});

app.delete('/api/super/admins/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM admins WHERE id=?').run(req.params.id);
    res.json({ success: true, message: 'Admin deleted successfully' });
  } catch(e) { res.status(500).json({ success: false, message: 'Database error' }); }
});
