function requirePermission(page) {
  return (req, res, next) => {
    if (!req.admin?.permissions?.[page]) {
      return res.status(403).json({ error: 'You do not have access to this section.' });
    }
    next();
  };
}

module.exports = requirePermission;