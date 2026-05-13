require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const reg = await pool.query("SELECT * FROM registrations WHERE usn = '1NC24CS999'");
  const sub = await pool.query("SELECT * FROM submissions WHERE usn = '1NC24CS999'");
  console.log('Registrations:', reg.rows);
  console.log('Submissions:', sub.rows);
  process.exit(0);
})();
