require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const registrationsRoute = require('./routes/registrations');
const authRoute = require('./routes/auth');
const sessionRoute = require('./routes/sessions');
const settingsRoute = require('./routes/settings');
const eventsRoute = require('./routes/events');
const funnelRoute = require('./routes/funnel');
const usersRoute = require('./routes/users');
const otpRoute = require('./routes/otp');
const rateLimit = require('express-rate-limit');
const auditRoute = require('./routes/audit');
const adminRoute = require('./routes/admins');
const requireAuth = require('./middleware/auth');

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Please wait and try again.' },
});
console.log('registrationsRoute:', typeof registrationsRoute);
console.log('authRoute:', typeof authRoute);
console.log('sessionRoute:', typeof sessionRoute);
console.log('settingsRoute:', typeof settingsRoute);
console.log('eventsRoute:', typeof eventsRoute);
console.log('funnelRoute:', typeof funnelRoute);
console.log('usersRoute:', typeof usersRoute);
console.log('otpRoute:', typeof otpRoute);
console.log('auditRoute:', typeof auditRoute);
console.log('adminRoute:', typeof adminRoute);
console.log('requireAuth:', typeof requireAuth);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use('/api/registrations', registrationsRoute);
app.use('/api/auth', authRoute);
app.use('/api/sessions', sessionRoute);
app.use('/api/settings', settingsRoute);
app.use('/api/events', eventsRoute);
app.use('/api/funnel', funnelRoute);
app.use('/api/users', usersRoute);
app.use('/api/otp', strictLimiter, otpRoute);
app.use('/api/audit',requireAuth, auditRoute);
app.use('/api/admins',requireAuth, adminRoute);  

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));