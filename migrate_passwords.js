const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    const { rows } = await pool.query('SELECT id, password FROM admins');
    console.log(`Found ${rows.length} admins. Migrating passwords...`);
    
    for (const admin of rows) {
      if (!admin.password.startsWith('$2b$')) {
        const hashedPassword = await bcrypt.hash(admin.password, 10);
        await pool.query('UPDATE admins SET password = $1 WHERE id = $2', [hashedPassword, admin.id]);
        console.log(`Migrated admin ID ${admin.id}`);
      } else {
        console.log(`Admin ID ${admin.id} already migrated.`);
      }
    }
    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
