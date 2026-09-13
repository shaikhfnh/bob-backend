const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const requireAuth = require('../middleware/auth');
const { logAction } = require('../utils/auditLog');

// GET /api/users — real people, deduplicated by email or phone,
// with a count of how many sessions each one registered for
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
  SELECT
    civil_id AS dedupe_key,
    MAX(first_name) AS first_name,
    MAX(last_name) AS last_name,
    MAX(email) AS email,
    MAX(phone) AS phone,
    MAX(civil_id) AS civil_id,
    COUNT(*) AS registrations,
    MIN(created_at) AS first_seen
  FROM registrants
  WHERE civil_id IS NOT NULL
  GROUP BY civil_id
  ORDER BY first_seen DESC
`);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch users:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

module.exports = router;


router.put('/:civilId', requireAuth, async (req, res) => {
  const { firstName, lastName, email, phone } = req.body;
  try {
    const [currentRows] = await pool.query('SELECT * FROM registrants WHERE civil_id = ? LIMIT 1', [req.params.civilId]);
    const current = currentRows[0];

    await pool.query(
      'UPDATE registrants SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE civil_id = ?',
      [firstName, lastName, email, phone, req.params.civilId]
    );

    const fieldsToCheck = [
      { key: 'firstName', old: current?.first_name, new: firstName },
      { key: 'lastName', old: current?.last_name, new: lastName },
      { key: 'email', old: current?.email, new: email },
      { key: 'phone', old: current?.phone, new: phone },
    ];
    const changes = {};
    fieldsToCheck.forEach((f) => {
      if (String(f.old) !== String(f.new)) {
        changes[f.key] = { from: f.old, to: f.new };
      }
    });

    logAction({
  adminEmail: req.admin.email,
  action: 'edit_user',
  targetType: 'user',
  targetId: req.params.civilId,
  targetName: `${firstName} ${lastName}`,
  targetCivilId: req.params.civilId,
  details: changes,
});

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});