const db = require('../config/db');

async function logAction({ adminEmail, action, targetType, targetId, targetName, targetCivilId, details }) {
  try {
    await db.query(
      'INSERT INTO admin_audit (admin_email, action, target_type, target_id, target_name, details) VALUES (?, ?, ?, ?, ?, ?)',
      [
        adminEmail, action, targetType, String(targetId), targetName || null,
        JSON.stringify({ ...details, _civilId: targetCivilId || null }),
      ]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = { logAction };