const express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const xss = require('xss');
const fs = require('fs');

dotenv.config();

const app = express();
app.set('trust proxy', 1);
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
        language TEXT DEFAULT 'English',
        redirect_url TEXT,
        is_active BOOLEAN DEFAULT TRUE
      );
      
      CREATE TABLE IF NOT EXISTS config (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        caption TEXT NOT NULL,
        image_path TEXT NOT NULL,
        admin_gid TEXT NOT NULL REFERENCES admins(gid) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add columns dynamically in case the tables already exist
    await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS admin_gid TEXT;`);
    await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS college_name TEXT;`);
    await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS year_of_study TEXT;`);
    await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS branch_major TEXT;`);
    await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS state TEXT;`);
    await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS city TEXT;`);
    await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS nano_banana_link TEXT;`);
    await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`);
    await pool.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS redirect_url TEXT;`);
    await pool.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;`);
    await pool.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS reg_id TEXT UNIQUE;`);
    // Seed admins individually to ensure all 10 exist
    const adminsToSeed = [
      { gid: '3082', name: 'Ganesh Naidu', max_count: 30, language: 'English' },
      { gid: '0000', name: 'Deekshitha R', max_count: 30, language: 'English' },
      { gid: '2633', name: 'Aadya Sinha', max_count: 30, language: 'English' },
      { gid: '2579', name: 'Amrutha Gowri U', max_count: 30, language: 'English' },
      { gid: '2634', name: 'Deekshitha G S', max_count: 30, language: 'English' },
      { gid: '2635', name: 'Siva Sankar Raju', max_count: 30, language: 'English' },
      { gid: '2636', name: 'Mohammadi Anjum', max_count: 30, language: 'English' },
      { gid: '2637', name: 'C Monish Reddy', max_count: 30, language: 'English' },
      { gid: '2638', name: 'Harsha', max_count: 30, language: 'English' },
      { gid: '2639', name: 'Rishitha', max_count: 30, language: 'English' }
    ];

    const defaultHash = await bcrypt.hash('admin', 10);
    for (const admin of adminsToSeed) {
      const { rows } = await pool.query('SELECT 1 FROM admins WHERE gid = $1', [admin.gid]);
      if (rows.length === 0) {
        await pool.query(
          'INSERT INTO admins (gid, name, password, max_count, language) VALUES ($1, $2, $3, $4, $5)',
          [admin.gid, admin.name, defaultHash, admin.max_count, admin.language]
        );
        console.log(`Seeded missing admin: ${admin.name} (${admin.gid})`);
      }
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
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
// Redirect .html requests to clean URLs and preserve query strings
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    const cleanPath = req.path.slice(0, -5);
    const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    return res.redirect(301, cleanPath + queryString);
  }
  next();
});

// Validate GSA parameter for register and feedback links
app.use(async (req, res, next) => {
  const isTargetRoute = req.path === '/register' || req.path === '/feedback';
  if (isTargetRoute && req.query.gsa) {
    try {
      const { rows } = await pool.query('SELECT id FROM admins WHERE gid = $1 AND is_active = TRUE', [req.query.gsa]);
      if (rows.length === 0) {
        return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
      }
    } catch (e) {
      console.error("GSA Validation Error", e);
    }
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));



const submitLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per IP
  message: { success: false, message: 'Too many requests from this IP, please try again after a minute' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP
  message: { success: false, message: 'Too many login attempts from this IP, please try again after 15 minutes' }
});

// Admin Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) return res.status(401).json({ success: false, message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid token' });
    if (!user.admin) return res.status(403).json({ success: false, message: 'Requires Super Admin privileges' });
    req.user = user;
    next();
  });
};

// --- ROUTES ---

// Submit
app.post('/api/submit', submitLimiter, async (req, res) => {
  let { usn, name, college_name, year_of_study, branch_major, state, city, nano_banana_link } = req.body;
  if (!usn || !name) return res.status(400).json({ success: false, message: 'USN and Name are required.' });
  
  usn = xss(usn);
  name = xss(name);
  college_name = college_name ? xss(college_name) : '';
  year_of_study = year_of_study ? xss(year_of_study) : '';
  branch_major = branch_major ? xss(branch_major) : '';
  state = state ? xss(state) : '';
  city = city ? xss(city) : '';
  nano_banana_link = nano_banana_link ? xss(nano_banana_link) : '';

  const usnRegex = /^1NC\d{2}([A-Z]{2,3})\d{2,3}$/i;
  if (!usnRegex.test(usn.toUpperCase())) return res.status(400).json({ success: false, message: 'Invalid USN format.' });
  const nameRegex = /^[a-zA-Z\s\.]{1,100}$/;
  if (!nameRegex.test(name)) return res.status(400).json({ success: false, message: 'Invalid Name format.' });

  try {
    // 1. Check if USN is registered
    const { rows: regRows } = await pool.query('SELECT admin_gid FROM registrations WHERE usn = $1', [usn.toUpperCase()]);
    if (regRows.length === 0) {
      return res.status(403).json({ success: false, message: 'USN not found. You must be registered to submit feedback.' });
    }
    const adminGid = regRows[0].admin_gid;

    // 2. Insert into submissions
    await pool.query('INSERT INTO submissions (usn, name, college_name, year_of_study, branch_major, state, city, nano_banana_link, admin_gid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', 
      [usn.toUpperCase(), name.trim(), college_name.trim(), year_of_study.trim(), branch_major.trim(), state.trim(), city.trim(), nano_banana_link.trim(), adminGid]);
    
    // 3. Get custom redirect URL for this specific admin
    const { rows: adminRows } = await pool.query('SELECT redirect_url FROM admins WHERE gid = $1', [adminGid]);
    let redirectUrl = adminRows.length > 0 ? adminRows[0].redirect_url : null;

    // 4. Fallback to global redirect if admin hasn't set one
    if (!redirectUrl || redirectUrl.trim() === '') {
      const { rows: configRows } = await pool.query("SELECT value FROM config WHERE key = 'redirect_url'");
      redirectUrl = configRows.length > 0 ? configRows[0].value : null;
    }

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
    const { rows } = await pool.query('SELECT usn, name, college_name, year_of_study, branch_major, state, city, nano_banana_link, submitted_at FROM submissions ORDER BY id DESC');
    let csv = 'USN,Name,College Name,Year of Study,Branch / Major,State,City,Nano Banana Link,Submitted At\n';
    rows.forEach(row => {
      const safeName = row.name.replace(/"/g, '""');
      csv += `"${row.usn}","${safeName}","${row.college_name || ''}","${row.year_of_study || ''}","${row.branch_major || ''}","${row.state || ''}","${row.city || ''}","${row.nano_banana_link || ''}","${row.submitted_at}"\n`;
    });
    res.header('Content-Type', 'text/csv');
    res.attachment('submissions.csv');
    return res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Export failed.' });
  }
});

// --- ADMIN ROUTES ---

app.post('/api/admin/login', loginLimiter, (req, res) => {
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

app.get('/api/public/registration-count', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM registrations');
    res.json({ success: true, count: parseInt(rows[0].count) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

app.get('/api/public/preview-gsa', async (req, res) => {
  const { lang } = req.query;
  if (!lang) return res.json({ success: false });
  try {
    const { rows: adminList } = await pool.query(`
      SELECT a.name, a.max_count, COUNT(r.id) as current_count 
      FROM admins a 
      LEFT JOIN registrations r ON a.gid = r.admin_gid 
      WHERE a.language = $1 AND a.is_active = TRUE 
      GROUP BY a.id
      ORDER BY a.id ASC
    `, [lang]);
    let minCount = Infinity;
    let assignedName = null;
    for (const admin of adminList) {
      const count = parseInt(admin.current_count);
      if (count < admin.max_count && count < minCount) {
        minCount = count;
        assignedName = admin.name;
      }
    }
    if (assignedName) {
      res.json({ success: true, name: assignedName });
    } else {
      res.json({ success: false, message: 'No slots available for this language.' });
    }
  } catch(e) { res.json({ success: false }); }
});

// --- REGISTRATION ROUTES ---
app.post('/api/register', submitLimiter, async (req, res) => {
  let { usn, name, mobile, email, adminChoice, languageChoice } = req.body;
  if (!usn || !name || !mobile || !email) return res.status(400).json({ success: false, message: 'All fields are required.' });
  
  usn = xss(usn).replace(/\s+/g, '');
  name = xss(name);
  mobile = xss(mobile);
  email = xss(email);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email format.' });
  }

  const usnRegex = /^1NC\d{2}([A-Z]{2,3})\d{2,3}$/i;
  const match = usn.toUpperCase().match(usnRegex);
  if (!match) return res.status(400).json({ success: false, message: 'Invalid USN format.' });
  const department = match[1].toUpperCase();

  try {
    const { rows: branchRows } = await pool.query("SELECT value FROM config WHERE key = 'allowed_branches'");
    const allowedBranchesStr = branchRows.length > 0 ? branchRows[0].value.trim() : 'CS,CI,CD,IS,EC,EE,ME,CV';
    
    if (allowedBranchesStr !== '') {
      const allowedBranches = allowedBranchesStr.split(',').map(b => b.trim().toUpperCase());
      if (!allowedBranches.includes(department)) {
        return res.status(400).json({ success: false, message: `Registrations from branch ${department} are currently not allowed.` });
      }
    }

    let assignedGid = null;
    
    if (adminChoice && adminChoice !== "") {
      const { rows: adminList } = await pool.query(`
        SELECT a.*, COUNT(r.id) as current_count 
        FROM admins a 
        LEFT JOIN registrations r ON a.gid = r.admin_gid 
        WHERE a.gid = $1 AND a.is_active = TRUE 
        GROUP BY a.id
      `, [adminChoice]);
      let minCount = Infinity;
      for (const admin of adminList) {
        const count = parseInt(admin.current_count);
        if (count < admin.max_count && count < minCount) {
          minCount = count;
          assignedGid = admin.gid;
        }
      }
      
      if (!assignedGid && adminList.length > 0) {
        return res.status(400).json({ success: false, message: `sorry you are late , slots over` });
      } else if (!assignedGid && adminList.length === 0) {
        return res.status(400).json({ success: false, message: `No GSA found.` });
      }
    } else if (languageChoice && languageChoice !== "") {
      const { rows: adminList } = await pool.query(`
        SELECT a.*, COUNT(r.id) as current_count 
        FROM admins a 
        LEFT JOIN registrations r ON a.gid = r.admin_gid 
        WHERE a.language = $1 AND a.is_active = TRUE 
        GROUP BY a.id
        ORDER BY a.id ASC
      `, [languageChoice]);
      let minCount = Infinity;
      for (const admin of adminList) {
        const count = parseInt(admin.current_count);
        if (count < admin.max_count && count < minCount) {
          minCount = count;
          assignedGid = admin.gid;
        }
      }
      if (!assignedGid && adminList.length > 0) {
        return res.status(400).json({ success: false, message: `sorry you are late , slots over` });
      } else if (!assignedGid && adminList.length === 0) {
        return res.status(400).json({ success: false, message: `No GSA found speaking ${languageChoice}.` });
      }
    } else {
      return res.status(400).json({ success: false, message: `Please select a language.` });
    }

    if (!assignedGid) return res.status(400).json({ success: false, message: 'sorry you are late , slots over' });

    const { rows: adminInfoRows } = await pool.query('SELECT * FROM admins WHERE gid = $1', [assignedGid]);
    const adminInfo = adminInfoRows[0];

    // Generate unique 4-digit ID
    let reg_id = '';
    while (true) {
      const tempId = Math.floor(1000 + Math.random() * 9000).toString();
      const { rows } = await pool.query('SELECT 1 FROM registrations WHERE reg_id = $1', [tempId]);
      if (rows.length === 0) {
        reg_id = tempId;
        break;
      }
    }

    await pool.query('INSERT INTO registrations (reg_id, usn, name, mobile, email, department, admin_gid) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
      [reg_id, usn.toUpperCase(), name.trim(), mobile.trim(), email.trim(), department, assignedGid]);

    res.json({ success: true, message: `Successfully registered! Assigned Admin: ${adminInfo.name} (${assignedGid})` });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: "This USN is already registered." });
    }
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// --- AR ADMIN ROUTES ---
const authenticateARToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.status(401).json({ success: false, message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid token' });
    req.user = user;
    next();
  });
};
app.post('/api/ar/login', loginLimiter, async (req, res) => {
  const { gid, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM admins WHERE gid = $1', [gid]);
    const adminInfo = rows[0];
    
    if (adminInfo && await bcrypt.compare(password, adminInfo.password)) {
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

app.get('/api/ar/config', authenticateARToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT redirect_url FROM admins WHERE gid = $1', [req.user.gid]);
    res.json({ success: true, redirect_url: rows[0]?.redirect_url });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

app.put('/api/ar/config', authenticateARToken, async (req, res) => {
  const { redirect_url } = req.body;
  try {
    await pool.query('UPDATE admins SET redirect_url = $1 WHERE gid = $2', [redirect_url, req.user.gid]);
    res.json({ success: true, message: 'Redirect URL updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

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
      SELECT s.id, s.usn, s.name, s.college_name, s.year_of_study, s.branch_major, s.state, s.city, s.nano_banana_link, s.submitted_at, s.is_deleted, r.reg_id 
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

app.put('/api/ar/feedback/:id/delete', authenticateARToken, async (req, res) => {
  try {
    await pool.query('UPDATE submissions SET is_deleted = TRUE WHERE id = $1 AND admin_gid = $2', [req.params.id, req.user.gid]);
    res.json({ success: true, message: 'Moved to Recycle Bin' });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.put('/api/ar/feedback/:id/restore', authenticateARToken, async (req, res) => {
  try {
    await pool.query('UPDATE submissions SET is_deleted = FALSE WHERE id = $1 AND admin_gid = $2', [req.params.id, req.user.gid]);
    res.json({ success: true, message: 'Restored successfully' });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.delete('/api/ar/feedback/:id', authenticateARToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM submissions WHERE id = $1 AND admin_gid = $2', [req.params.id, req.user.gid]);
    res.json({ success: true, message: 'Permanently deleted' });
  } catch (err) { res.status(500).json({ success: false }); }
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

app.post('/api/ar/registration', authenticateARToken, async (req, res) => {
  let { usn, name, mobile, email, department } = req.body;
  if (!usn || !name || !mobile || !email || !department) return res.status(400).json({ success: false, message: 'All fields are required.' });
  
  usn = xss(usn).replace(/\s+/g, ''); name = xss(name); mobile = xss(mobile); email = xss(email); department = xss(department);
  
  try {
    // Check limit
    const { rows: adminList } = await pool.query(`SELECT a.max_count, COUNT(r.id) as current_count FROM admins a LEFT JOIN registrations r ON a.gid = r.admin_gid WHERE a.gid = $1 GROUP BY a.id`, [req.user.gid]);
    if(adminList.length > 0 && parseInt(adminList[0].current_count) >= adminList[0].max_count) {
      return res.status(400).json({ success: false, message: 'sorry you are late , slots over' });
    }

    let reg_id = '';
    while (true) {
      const tempId = Math.floor(1000 + Math.random() * 9000).toString();
      const { rows } = await pool.query('SELECT 1 FROM registrations WHERE reg_id = $1', [tempId]);
      if (rows.length === 0) { reg_id = tempId; break; }
    }

    await pool.query('INSERT INTO registrations (reg_id, usn, name, mobile, email, department, admin_gid) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
      [reg_id, usn.toUpperCase(), name.trim(), mobile.trim(), email.trim(), department.toUpperCase(), req.user.gid]);
    res.json({ success: true, message: 'Registration added successfully' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: "This USN is already registered." });
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

app.put('/api/ar/registration/:id', authenticateARToken, async (req, res) => {
  let { usn, name, mobile, email, department } = req.body;
  if (!usn || !name || !mobile || !email || !department) return res.status(400).json({ success: false, message: 'All fields are required.' });
  
  usn = xss(usn).replace(/\s+/g, ''); name = xss(name); mobile = xss(mobile); email = xss(email); department = xss(department);
  
  try {
    const result = await pool.query('UPDATE registrations SET usn=$1, name=$2, mobile=$3, email=$4, department=$5 WHERE id=$6 AND admin_gid=$7', 
      [usn.toUpperCase(), name.trim(), mobile.trim(), email.trim(), department.toUpperCase(), req.params.id, req.user.gid]);
    if(result.rowCount === 0) return res.status(404).json({ success: false, message: 'Not found or no permission' });
    res.json({ success: true, message: 'Registration updated successfully' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: "This USN is already registered." });
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// --- GSA POSTS ROUTES ---

app.post('/api/posts', authenticateARToken, async (req, res) => {
  let { caption, image } = req.body;
  if (!caption || !image) {
    return res.status(400).json({ success: false, message: 'Image and caption are required.' });
  }

  caption = xss(caption).trim();
  if (!image.startsWith('data:image/')) {
    return res.status(400).json({ success: false, message: 'Invalid image format.' });
  }

  try {
    // Insert post into database directly storing the base64 image URL in image_path
    const query = 'INSERT INTO posts (caption, image_path, admin_gid) VALUES ($1, $2, $3) RETURNING *';
    const { rows } = await pool.query(query, [caption, image, req.user.gid]);
    
    logAction('Create Post', `AR Admin ${req.user.name} (${req.user.gid}) created post ID ${rows[0].id}`);
    res.json({ success: true, message: 'Post uploaded successfully', data: rows[0] });
  } catch (dbErr) {
    console.error('Post creation database error:', dbErr);
    res.status(500).json({ success: false, message: 'Database error while saving post.' });
  }
});

app.get('/api/posts', async (req, res) => {
  try {
    const query = `
      SELECT p.id, p.caption, p.image_path, p.created_at, a.name as author_name, a.language
      FROM posts p
      JOIN admins a ON p.admin_gid = a.gid
      ORDER BY p.created_at DESC
    `;
    const { rows } = await pool.query(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Fetch posts error:', err);
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

app.get('/api/ar/posts', authenticateARToken, async (req, res) => {
  try {
    const query = 'SELECT * FROM posts WHERE admin_gid = $1 ORDER BY created_at DESC';
    const { rows } = await pool.query(query, [req.user.gid]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

app.delete('/api/posts/:id', authenticateARToken, async (req, res) => {
  const postId = req.params.id;
  try {
    // Check ownership
    const checkQuery = 'SELECT * FROM posts WHERE id = $1';
    const { rows: checkRows } = await pool.query(checkQuery, [postId]);
    if (checkRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }
    
    const post = checkRows[0];
    if (post.admin_gid !== req.user.gid) {
      return res.status(403).json({ success: false, message: 'You can only delete your own posts.' });
    }
    
    // Delete from database
    await pool.query('DELETE FROM posts WHERE id = $1', [postId]);
    
    logAction('Delete Post', `AR Admin ${req.user.name} (${req.user.gid}) deleted post ID ${postId}`);
    res.json({ success: true, message: 'Post deleted successfully.' });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

app.get('/api/admins', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT gid, name, max_count, language FROM admins WHERE is_active = TRUE ORDER BY id ASC');
    res.json({ success: true, data: rows });
  } catch(e) {
    res.status(500).json({ success: false });
  }
});

// --- SUPER ADMIN ROUTES ---
app.get('/api/super/admins', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, COUNT(r.id) as current_count
      FROM admins a
      LEFT JOIN registrations r ON a.gid = r.admin_gid
      GROUP BY a.id
      ORDER BY a.id ASC
    `);
    res.json({ success: true, data: rows });
  } catch(e) { res.status(500).json({ success: false }); }
});

app.get('/api/super/all-registrations', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.*, a.name as admin_name 
      FROM registrations r 
      LEFT JOIN admins a ON r.admin_gid = a.gid 
      ORDER BY a.name ASC, r.id ASC
    `);
    res.json({ success: true, data: rows });
  } catch(e) { res.status(500).json({ success: false }); }
});

app.post('/api/super/admins', authenticateToken, async (req, res) => {
  const { gid, name, password, max_count, language, is_active } = req.body;
  const active = is_active !== undefined ? is_active : true;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO admins (gid, name, password, max_count, language, is_active) VALUES ($1, $2, $3, $4, $5, $6)', 
      [gid, name, hashedPassword, max_count || 30, language || 'English', active]);
    res.json({ success: true, message: 'Admin added successfully' });
  } catch(e) { res.status(500).json({ success: false, message: 'GID already exists or invalid data' }); }
});

app.put('/api/super/admins/:id', authenticateToken, async (req, res) => {
  const { gid, name, password, max_count, language, is_active } = req.body;
  const active = is_active !== undefined ? is_active : true;
  try {
    let finalPassword = password;
    if (password && !password.startsWith('$2b$')) {
      finalPassword = await bcrypt.hash(password, 10);
    }
    await pool.query('UPDATE admins SET gid=$1, name=$2, password=$3, max_count=$4, language=$5, is_active=$6 WHERE id=$7', 
      [gid, name, finalPassword, max_count, language || 'English', active, req.params.id]);
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

app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
