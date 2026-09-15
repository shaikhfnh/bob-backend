const ROLE_DEFAULTS = {
  owner: {
    dashboard: true, bookings: true, users: true, sessions: true,
    analytics: true, notifications: true, audit_log: true, audit_log_admin: true,
    team: true, manage_passwords: true,
  },
  admin: {
    dashboard: true, bookings: true, users: true, sessions: true,
    analytics: true, notifications: true, audit_log: true, audit_log_admin: false,
    team: false, manage_passwords: false,
  },
  staff: {
    dashboard: true, bookings: true, users: false, sessions: true,
    analytics: false, notifications: false, audit_log: false, audit_log_admin: false,
    team: false, manage_passwords: false,
  },
};

function resolvePermissions(role, overrides) {
  const base = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.staff;
  return { ...base, ...(overrides || {}) };
}

function canAccess(role, overrides, page) {
  return resolvePermissions(role, overrides)[page] === true;
}

// Real hierarchy rule for who can edit whose ROLE/ACCESS (not passwords —
// see manage_passwords for that, which is separately grantable):
// Owner → anyone. Admin → Staff only. Staff → no one.
function canEditRoleOf(actorRole, targetRole) {
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') return targetRole === 'staff';
  return false;
}

module.exports = { ROLE_DEFAULTS, resolvePermissions, canAccess, canEditRoleOf };