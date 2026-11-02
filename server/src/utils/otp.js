const crypto = require('crypto');
const Otp = require('../models/Otp');
const { ApiError, sha256 } = require('./helpers');
const { sendEmail } = require('./email');

const TTL_MIN = 10;
const COOLDOWN_SEC = 30;
const MAX_ATTEMPTS = 5;

const hash = (email, purpose, code) => sha256(`${email}:${purpose}:${code}:${process.env.JWT_ACCESS_SECRET}`);

const COPY = {
  verify: { subject: 'Verify your email', title: 'Verify your email address', lead: 'Use this code to finish creating your TaskFlow account.' },
  reset: { subject: 'Your password reset code', title: 'Reset your password', lead: 'Use this code to reset your TaskFlow password.' },
};

/** Creates and emails a 6-digit code. Enforces a resend cooldown. */
const sendOtp = async (email, purpose, name = '') => {
  const existing = await Otp.findOne({ email, purpose });
  if (existing) {
    const wait = COOLDOWN_SEC - Math.floor((Date.now() - existing.updatedAt.getTime()) / 1000);
    if (wait > 0) throw new ApiError(429, `Please wait ${wait}s before requesting another code`);
  }
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await Otp.findOneAndUpdate(
    { email, purpose },
    { codeHash: hash(email, purpose, code), attempts: 0, expiresAt: new Date(Date.now() + TTL_MIN * 60000) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const c = COPY[purpose];
  await sendEmail({
    to: email,
    subject: `${c.subject}: ${code}`,
    title: c.title,
    body: `${name ? `Hi ${name}, ` : ''}${c.lead}<br/><br/><span style="font-size:30px;font-weight:700;letter-spacing:8px">${code}</span><br/><br/>This code expires in ${TTL_MIN} minutes. If you did not request it, you can ignore this email.`,
    devNote: `OTP (${purpose}) for ${email}: ${code}`,
  });
};

/** Checks a code. Deletes it on success; counts attempts on failure. */
const checkOtp = async (email, purpose, code) => {
  const rec = await Otp.findOne({ email, purpose });
  if (!rec || rec.expiresAt < new Date()) throw new ApiError(400, 'Code expired. Request a new one');
  if (rec.attempts >= MAX_ATTEMPTS) { await rec.deleteOne(); throw new ApiError(429, 'Too many attempts. Request a new code'); }
  if (rec.codeHash !== hash(email, purpose, String(code).trim())) {
    rec.attempts += 1;
    await rec.save();
    throw new ApiError(400, `Incorrect code. ${MAX_ATTEMPTS - rec.attempts} attempt(s) left`);
  }
  await rec.deleteOne();
};

module.exports = { sendOtp, checkOtp, COOLDOWN_SEC };
