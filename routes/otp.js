const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { sendOtpEmail } = require('../services/emailService');

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

router.post('/send', async (req, res) => {
  const { email } = req.body;
  if (!email?.includes('@')) return res.status(400).json({ error: 'Valid email is required.' });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    await db.query('INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)', [email, code, expiresAt]);
    const result = await sendOtpEmail({ to: email, code });
   if (!result.sent) return res.status(500).json({ error: `Failed to send: ${result.reason}` });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify', async (req, res) => {
  const { email, code } = req.body;
  try {
    const [rows] = await db.query(
      `SELECT * FROM otp_codes WHERE email = ? AND code = ? AND verified = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, code]
    );
    if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired code.' });

    await db.query('UPDATE otp_codes SET verified = TRUE WHERE id = ?', [rows[0].id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;