require('dotenv').config({ path: __dirname + '/../.env' });
const bcrypt = require('bcrypt');
const db = require('../config/db');

async function run() {
  const email = 'dev@fnh.com';   
  const password = '12345678'; // Change this to a secure password in production
  const name = 'Developer Admin';

  const hash = await bcrypt.hash(password, 10);
  await db.query('INSERT INTO admin_users (email, password_hash, name) VALUES (?, ?, ?)', [email, hash, name]);
  console.log('Admin created:', email);
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });