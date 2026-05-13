const express = require('express');
const { Pool } = require('pg');
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

// Verify DATABASE_URL exists
if (!process.env.DATABASE_URL) {
  console.warn("⚠️ WARNING: DATABASE_URL is not set in your .env file!");
  console.warn("Please add it before running the app in production.");
}

// DB Init
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/dbname',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Setup DB schema
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        usn TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        usn TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        mobile TEXT NOT NULL,
        email TEXT NOT NULL,
        department TEXT NOT NULL,
        admin_gid TEXT NOT NULL,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        gid TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password TEXT NOT NULL,
        max_count INTEGER DEFAULT 30,
        language TEXT DEFAULT 'English'
      );
      
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed admins if empty
    const { rows: countRows } = await pool.query('SELECT COUNT(*) as count FROM admins');
    if (parseInt(countRows[0].count) === 0) {
      const insertQuery = 'INSERT INTO admins (gid, name, password, max_count) VALUES ($1, $2, $3, $4)';
      await pool.query(insertQuery, ['3082', 'Ganesh', 'Admin1', 30]);
      await pool.query(insertQuery, ['0000', 'Deekshitha R', 'Admin 2', 30]);
      await pool.query(insertQuery, ['2633', 'Aadya', 'Admin3', 30]);
      await pool.query(insertQuery, ['2579', 'Amrutha gowri', 'Admin3', 30]);
      await pool.query(insertQuery, ['2634', 'Deekshitha G S', 'Admin 4', 30]);
      console.log('Seeded admins to PostgreSQL DB.');
    }
  } catch (e) {
    console.error('DB Init Error', e);
  }
};
initDB();

// Helper to log actions
const logAction = async (action, details) => {
  try {
    await pool.query('INSERT INTO logs (action, details) VALUES ($1, $2)', [action, details]);
  } catch(e) {
    console.error('Log error', e);
  }
}

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
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
app.post('/api/submit', submitLimiter, async (req, res) => {
  const { usn, name } = req.body;
  if (!usn || !name) return res.status(400).json({ success: false, message: 'USN and Name are required.' });

  const usnRegex = /^1NC2[03456789]([A-Z]{2})\d{3}$/i;
  if (!usnRegex.test(usn.toUpperCase())) return res.status(400).json({ success: false, message: 'Invalid USN format.' });
  const nameRegex = /^[a-zA-Z\s\.]{1,100}$/;
  if (!nameRegex.test(name)) return res.status(400).json({ success: false, message: 'Invalid Name format.' });

  try {
    await pool.query('INSERT INTO submissions (usn, name) VALUES ($1, $2)', [usn.toUpperCase(), name.trim()]);
    
    const { rows: configRows } = await pool.query("SELECT value FROM config WHERE key = 'redirect_url'");
    const redirectUrl = configRows.length > 0 ? configRows[0].value : null;

    res.json({ success: true, redirect_url: redirectUrl, message: 'Thank you for your submission!' });
  } catch (err) {
    if (err.code === '23505') { // Postgres Unique Violation
      return res.status(409).json({ success: false, message: "You've already submitted. Thanks!" });
    }
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// Get Submissions
app.get('/api/submissions', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM submissions ORDER BY id DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// Export CSV
app.get('/api/export', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT usn, name, submitted_at FROM submissions ORDER BY id DESC');
    let csv = 'USN,Name,Submitted At\n';
    rows.forEach(row => {
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

app.get('/api/admin/config', authenticateToken, async (req, res) => {
  try {
    const { rows: urlRows } = await pool.query("SELECT value FROM config WHERE key = 'redirect_url'");
    const { rows: branchRows } = await pool.query("SELECT value FROM config WHERE key = 'allowed_branches'");
    res.json({ 
      success: true, 
      redirect_url: urlRows.length > 0 ? urlRows[0].value : '',
      allowed_branches: branchRows.length > 0 ? branchRows[0].value : 'CS,CI,CD,IS,EC,EE,ME,CV'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

app.put('/api/admin/config', authenticateToken, async (req, res) => {
  const { redirect_url, allowed_branches } = req.body;
  try {
    const query = "INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value";
    if (redirect_url !== undefined) await pool.query(query, ['redirect_url', redirect_url]);
    if (allowed_branches !== undefined) await pool.query(query, ['allowed_branches', allowed_branches.toUpperCase()]);
    
    logAction('Config Update', `Redirect URL: ${redirect_url}, Branches: ${allowed_branches}`);
    res.json({ success: true, message: 'Config updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

app.delete('/api/admin/clear', authenticateToken, async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ success: false, message: 'Invalid password' });
  try {
    await pool.query("TRUNCATE TABLE submissions RESTART IDENTITY CASCADE");
    logAction('Clear Data', 'All submissions data was cleared');
    res.json({ success: true, message: 'All data cleared successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

app.delete('/api/admin/submission/:id', authenticateToken, async (req, res) => {
  const id = req.params.id;
  try {
    const { rows } = await pool.query('SELECT usn FROM submissions WHERE id = $1', [id]);
    const result = await pool.query('DELETE FROM submissions WHERE id = $1', [id]);
    
    if (result.rowCount > 0) {
      logAction('Delete Submission', `Deleted submission ID: ${id}, USN: ${rows[0]?.usn}`);
      res.json({ success: true, message: 'Submission deleted' });
    } else {
      res.status(404).json({ success: false, message: 'Submission not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

app.get('/api/admin/logs', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM logs ORDER BY id DESC LIMIT 50');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// --- REGISTRATION ROUTES ---
app.post('/api/register', submitLimiter, async (req, res) => {
  const { usn, name, mobile, email, adminChoice, languageChoice } = req.body;
  if (!usn || !name || !mobile || !email) return res.status(400).json({ success: false, message: 'All fields are required.' });

  if (!email.toLowerCase().endsWith('@ncetmail.com')) {
    return res.status(400).json({ success: false, message: 'Only college emails (@ncetmail.com) are allowed.' });
  }

  const usnRegex = /^1NC2[03456789]([A-Z]{2})\d{3}$/i;
  const match = usn.toUpperCase().match(usnRegex);
  if (!match) return res.status(400).json({ success: false, message: 'Invalid USN format.' });
  const department = match[1].toUpperCase();

  try {
    const { rows: branchRows } = await pool.query("SELECT value FROM config WHERE key = 'allowed_branches'");
    const allowedBranchesStr = branchRows.length > 0 ? branchRows[0].value : 'CS,CI,CD,IS,EC,EE,ME,CV';
    const allowedBranches = allowedBranchesStr.split(',').map(b => b.trim().toUpperCase());
    
    if (!allowedBranches.includes(department)) {
      return res.status(400).json({ success: false, message: `Registrations from branch ${department} are currently not allowed.` });
    }

    let assignedGid = null;
    
    if (adminChoice && adminChoice !== "") {
      const { rows: adminList } = await pool.query('SELECT * FROM admins WHERE gid = $1', [adminChoice]);
      let minCount = 31;
      for (const admin of adminList) {
        const { rows: countRows } = await pool.query('SELECT COUNT(*) as count FROM registrations WHERE admin_gid = $1', [admin.gid]);
        const count = parseInt(countRows[0].count);
        if (count < admin.max_count && count < minCount) {
          minCount = count;
          assignedGid = admin.gid;
        }
      }
      
      if (!assignedGid && adminList.length > 0) {
        return res.status(400).json({ success: false, message: `The selected GSA has reached the max limit.` });
      } else if (!assignedGid && adminList.length === 0) {
        return res.status(400).json({ success: false, message: `No GSA found.` });
      }
    } else if (languageChoice && languageChoice !== "") {
      const { rows: adminList } = await pool.query('SELECT * FROM admins WHERE language = $1 ORDER BY id ASC', [languageChoice]);
      let minCount = 31;
      for (const admin of adminList) {
        const { rows: countRows } = await pool.query('SELECT COUNT(*) as count FROM registrations WHERE admin_gid = $1', [admin.gid]);
        const count = parseInt(countRows[0].count);
        if (count < admin.max_count && count < minCount) {
          minCount = count;
          assignedGid = admin.gid;
        }
      }
      if (!assignedGid && adminList.length > 0) {
        return res.status(400).json({ success: false, message: `All GSAs speaking ${languageChoice} have reached their limit.` });
      } else if (!assignedGid && adminList.length === 0) {
        return res.status(400).json({ success: false, message: `No GSA found speaking ${languageChoice}.` });
      }
    } else {
      return res.status(400).json({ success: false, message: `Please select a language.` });
    }

    if (!assignedGid) return res.status(400).json({ success: false, message: 'Registration is full. No available slots.' });

    const { rows: adminInfoRows } = await pool.query('SELECT * FROM admins WHERE gid = $1', [assignedGid]);
    const adminInfo = adminInfoRows[0];

    await pool.query('INSERT INTO registrations (usn, name, mobile, email, department, admin_gid) VALUES ($1, $2, $3, $4, $5, $6)', 
      [usn.toUpperCase(), name.trim(), mobile.trim(), email.trim(), department, assignedGid]);

    res.json({ success: true, message: `Successfully registered! Assigned Admin: ${adminInfo.name} (${assignedGid})` });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: "This USN is already registered." });
    }
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// --- AR ADMIN ROUTES ---
app.post('/api/ar/login', async (req, res) => {
  const { gid, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM admins WHERE gid = $1 AND password = $2', [gid, password]);
    const adminInfo = rows[0];
    
    if (adminInfo) {
      const token = jwt.sign({ gid: adminInfo.gid, name: adminInfo.name }, JWT_SECRET, { expiresIn: '12h' });
      logAction('AR Login', `AR Admin ${adminInfo.name} (${gid}) logged in`);
      res.json({ success: true, token, name: adminInfo.name });
    } else {
      res.status(401).json({ success: false, message: 'Invalid GID or Password' });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: 'Database error.' });
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

app.get('/api/ar/registrations', authenticateARToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM registrations WHERE admin_gid = $1 ORDER BY id DESC', [req.user.gid]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

app.get('/api/ar/feedback', authenticateARToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.usn, s.name, s.submitted_at 
      FROM submissions s
      JOIN registrations r ON s.usn = r.usn
      WHERE r.admin_gid = $1
      ORDER BY s.submitted_at DESC
    `, [req.user.gid]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

app.get('/api/ar/export', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).send('No token provided');
  
  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err || !user.gid) return res.status(403).send('Invalid token');
    
    try {
      const { rows } = await pool.query('SELECT usn, name, mobile, email, department, registered_at FROM registrations WHERE admin_gid = $1 ORDER BY id DESC', [user.gid]);
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

app.delete('/api/ar/registration/:id', authenticateARToken, async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('DELETE FROM registrations WHERE id = $1 AND admin_gid = $2', [id, req.user.gid]);
    if (result.rowCount > 0) {
      logAction('Delete Registration', `AR Admin ${req.user.gid} deleted registration ID: ${id}`);
      res.json({ success: true, message: 'Registration removed successfully.' });
    } else {
      res.status(404).json({ success: false, message: 'Registration not found or you do not have permission to delete it.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

app.get('/api/admins', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT gid, name, max_count, language FROM admins ORDER BY id ASC');
    res.json({ success: true, data: rows });
  } catch(e) {
    res.status(500).json({ success: false });
  }
});

// --- SUPER ADMIN ROUTES ---
app.get('/api/super/admins', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM admins ORDER BY id ASC');
    res.json({ success: true, data: rows });
  } catch(e) { res.status(500).json({ success: false }); }
});

app.post('/api/super/admins', authenticateToken, async (req, res) => {
  const { gid, name, password, max_count, language } = req.body;
  try {
    await pool.query('INSERT INTO admins (gid, name, password, max_count, language) VALUES ($1, $2, $3, $4, $5)', 
      [gid, name, password, max_count || 30, language || 'English']);
    res.json({ success: true, message: 'Admin added successfully' });
  } catch(e) { res.status(500).json({ success: false, message: 'GID already exists or invalid data' }); }
});

app.put('/api/super/admins/:id', authenticateToken, async (req, res) => {
  const { gid, name, password, max_count, language } = req.body;
  try {
    await pool.query('UPDATE admins SET gid=$1, name=$2, password=$3, max_count=$4, language=$5 WHERE id=$6', 
      [gid, name, password, max_count, language || 'English', req.params.id]);
    res.json({ success: true, message: 'Admin updated successfully' });
  } catch(e) { res.status(500).json({ success: false, message: 'Database error' }); }
});

app.delete('/api/super/admins/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM admins WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'Admin deleted successfully' });
  } catch(e) { res.status(500).json({ success: false, message: 'Database error' }); }
});

app.delete('/api/super/clear-feedback', authenticateToken, async (req, res) => {
  try {
    await pool.query("TRUNCATE TABLE submissions RESTART IDENTITY CASCADE");
    logAction('Clear Data', 'Super Admin cleared ALL feedback submissions');
    res.json({ success: true, message: 'All feedback deleted successfully' });
  } catch(e) { res.status(500).json({ success: false, message: 'Database error' }); }
});

app.delete('/api/super/clear-registrations', authenticateToken, async (req, res) => {
  try {
    await pool.query("TRUNCATE TABLE registrations RESTART IDENTITY CASCADE");
    logAction('Clear Data', 'Super Admin cleared ALL registrations');
    res.json({ success: true, message: 'All registrations deleted successfully' });
  } catch(e) { res.status(500).json({ success: false, message: 'Database error' }); }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
