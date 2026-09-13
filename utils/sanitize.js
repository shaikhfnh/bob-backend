
const xss = require('xss');

// Strips any HTML/script content from user-provided text before it ever
// reaches the database. Applied to every free-text field a visitor or
// admin can type into — names, emails, session content, etc.
function clean(value) {
  if (value === null || value === undefined) return value;
  return xss(String(value).trim());
}

// For fields where we expect a whole object of user input (like a
// registration form), clean every string value at once.
function cleanFields(obj, keys) {
  const result = { ...obj };
  keys.forEach((key) => {
    if (result[key] !== undefined) result[key] = clean(result[key]);
  });
  return result;
}

module.exports = { clean, cleanFields };