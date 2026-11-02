const nodemailer = require('nodemailer');

let transporter;
const getTransporter = () => {
  if (transporter) return transporter;
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
};

const wrap = (title, body, cta) => `
<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;border-radius:16px;overflow:hidden;border:1px solid #eee">
  <div style="background:linear-gradient(135deg,#1F3A5F,#3B6EA8);padding:24px;color:#fff;font-size:22px;font-weight:700">TaskFlow</div>
  <div style="padding:24px;color:#222">
    <h2 style="margin-top:0">${title}</h2>
    <p style="line-height:1.6">${body}</p>
    ${cta ? `<p><a href="${cta.url}" style="display:inline-block;background:#3B6EA8;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">${cta.label}</a></p>` : ''}
  </div>
</div>`;

const sendEmail = async ({ to, subject, title, body, cta, devNote }) => {
  try {
    const info = await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || 'TaskFlow <no-reply@taskflow.app>',
      to,
      subject,
      html: wrap(title || subject, body, cta),
    });
    if (!process.env.SMTP_HOST) {
      console.log(`[dev email] to=${to} subject="${subject}"${cta ? ` link=${cta.url}` : ''}${devNote ? `\n[dev email] ${devNote}` : ''}`);
    }
    return info;
  } catch (err) {
    console.error('Email failed:', err.message);
    return null;
  }
};

module.exports = { sendEmail };
