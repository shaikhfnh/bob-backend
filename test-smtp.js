require('dotenv').config();
const nodemailer = require('nodemailer');

async function testSmtp() {
  console.log('--- SMTP Test ---');
  console.log('Host:', process.env.SMTP_HOST);
  console.log('Port:', process.env.SMTP_PORT);
  console.log('User:', process.env.SMTP_USERNAME);
  console.log('Pass set:', !!process.env.SMTP_PASSWORD);
  console.log('-----------------');

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'ssl' || process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // Step 1: verify() checks the connection + auth WITHOUT sending anything
  try {
    await transporter.verify();
    console.log('✅ Connection + authentication successful');
  } catch (err) {
    console.error('❌ Connection/auth FAILED:', err.message);
    return;
  }

  // Step 2: actually send a real test email
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to: 'shaikh.fnh@gmail.com', // change to whatever you want to test
      subject: 'SMTP test — ' + new Date().toISOString(),
      text: 'If you see this, SMTP delivery is genuinely working.',
    });
    console.log('✅ Send accepted. Response:', info.response);
    console.log('Accepted:', info.accepted);
    console.log('Rejected:', info.rejected);
    console.log('Message ID:', info.messageId);
  } catch (err) {
    console.error('❌ Send FAILED:', err.message);
  }
}

testSmtp();