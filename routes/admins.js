const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/db');
const requireAuth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const { logAction } = require('../utils/auditLog');
const { ROLE_DEFAULTS, canEditRoleOf } = require('../utils/permissions');

// Permissions ONLY an Owner may grant to anyone — even an Admin managing
// a Staff member cannot flip these on, regardless of what else they can edit.
const OWNER_ONLY_PERMISSIONS = ['team', 'audit_log_admin', 'manage_passwords'];

function stripOwnerOnlyPermissions(actorRole, overrides) {
  if (actorRole === 'owner' || !overrides) return overrides;
  const clean = { ...overrides };
  OWNER_ONLY_PERMISSIONS.forEach((key) => delete clean[key]);
  return clean;
}

router.get('/', requireAuth, requirePermission('team'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, email, name, role, permission_overrides, last_login_at, created_at FROM admin_users ORDER BY created_at ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  if (req.admin.role !== 'owner') return res.status(403).json({ error: 'Only an Owner can add team members.' });

  const { email, password, name, role } = req.body;
  if (!ROLE_DEFAULTS[role]) return res.status(400).json({ error: 'Invalid role.' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO admin_users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [email, hash, name, role]
    );
    logAction({ adminEmail: req.admin.email, action: 'create_admin', targetType: 'admin', targetId: result.insertId, targetName: `${name} (${email})`, details: { role } });
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const { name, role, permission_overrides } = req.body;

  try {
    const [targetRows] = await db.query('SELECT * FROM admin_users WHERE id = ?', [req.params.id]);
    const target = targetRows[0];
    if (!target) return res.status(404).json({ error: 'Account not found.' });

    if (!canEditRoleOf(req.admin.role, target.role)) {
      return res.status(403).json({ error: 'You do not have permission to edit this account.' });
    }
    if (!canEditRoleOf(req.admin.role, role)) {
      return res.status(403).json({ error: 'You cannot assign that role.' });
    }

    const cleanOverrides = stripOwnerOnlyPermissions(req.admin.role, permission_overrides);

    await db.query(
      'UPDATE admin_users SET name = ?, role = ?, permission_overrides = ? WHERE id = ?',
      [name, role, cleanOverrides ? JSON.stringify(cleanOverrides) : null, req.params.id]
    );

    // Real before/after diff — same pattern as edit_booking, so the audit
    // detail modal renders "Name: OldName → NewName" correctly instead of
    // just dumping the raw new values with no comparison.
    const changes = {};
    if (target.name !== name) changes.name = { from: target.name, to: name };
    if (target.role !== role) changes.role = { from: target.role, to: role };
    const oldOverridesStr = JSON.stringify(target.permission_overrides || {});
    const newOverridesStr = JSON.stringify(cleanOverrides || {});
    if (oldOverridesStr !== newOverridesStr) {
      changes.permissions = { from: oldOverridesStr, to: newOverridesStr };
    }

    logAction({
      adminEmail: req.admin.email,
      action: 'edit_admin_access',
      targetType: 'admin',
      targetId: req.params.id,
      targetName: `${name} (${target.email})`,
      details: changes,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/password', requireAuth, requirePermission('manage_passwords'), async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  try {
    const [targetRows] = await db.query('SELECT role, email, name FROM admin_users WHERE id = ?', [req.params.id]);
    const target = targetRows[0];
    if (!target) return res.status(404).json({ error: 'Account not found.' });
    if (!canEditRoleOf(req.admin.role, target.role)) {
      return res.status(403).json({ error: "You do not have permission to reset this account's password." });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE admin_users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
    logAction({ adminEmail: req.admin.email, action: 'reset_password', targetType: 'admin', targetId: req.params.id, targetName: `${target.name} (${target.email})` });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  if (String(req.admin.id) === req.params.id) return res.status(400).json({ error: "You can't remove your own account." });

  try {
    const [targetRows] = await db.query('SELECT role FROM admin_users WHERE id = ?', [req.params.id]);
    const target = targetRows[0];
    if (!target || !canEditRoleOf(req.admin.role, target.role)) {
      return res.status(403).json({ error: 'You do not have permission to remove this account.' });
    }
    await db.query('DELETE FROM admin_users WHERE id = ?', [req.params.id]);
    logAction({ adminEmail: req.admin.email, action: 'remove_admin', targetType: 'admin', targetId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;