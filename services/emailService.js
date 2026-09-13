const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'ssl' || process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD,
  },
});

async function sendConfirmationEmail({ to, name, sessionTitle }) {
  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject: "You're registered — Boubyan Home-Building Webinar Series",
      html: `<p>Hi ${name},</p><p>You're confirmed for <strong>${sessionTitle}</strong>. We'll send session details closer to the date.</p>`,
    });
    return { sent: true };
  } catch (err) {
    console.error('Failed to send confirmation email:', err.message);
    return { sent: false, reason: err.message };
  }
}

async function sendOtpEmail({ to, code }) {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject: 'Your verification code',
      html: `<p>Your verification code is:</p><h2 style="letter-spacing:4px;">${code}</h2><p>This code expires in 10 minutes.</p>`,
    });
    console.log('SMTP response:', info.response);
    console.log('Accepted:', info.accepted, 'Rejected:', info.rejected);
    return { sent: true };
  } catch (err) {
    console.error('Failed to send OTP email:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendConfirmationEmail, sendOtpEmail };