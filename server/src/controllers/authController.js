const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Project = require('../models/Project');
const Session = require('../models/Session');
const {
  ApiError, asyncHandler, send, signAccess, signRefresh, sha256, setAuthCookies, clearAuthCookies,
} = require('../utils/helpers');
const { parseDevice } = require('../utils/device');
const { sendOtp, checkOtp, COOLDOWN_SEC } = require('../utils/otp');
const { notify } = require('../utils/notify');

const MAX_DEVICES = Number(process.env.MAX_DEVICES) || 5;
const SESSION_DAYS = 7;

const publicUser = (u) => {
  const o = u.toObject ? u.toObject() : u;
  delete o.password;
  delete o.refreshTokenHash;
  delete o.resetPasswordToken;
  delete o.resetPasswordExpire;
  return o;
};

/** Registers this device as a session (evicting the oldest beyond the limit) and sets cookies. */
const startSession = async (req, res, user) => {
  const d = parseDevice(req);
  const sessions = await Session.find({ user: user._id }).sort('lastActive');
  const overflow = sessions.length - (MAX_DEVICES - 1);
  if (overflow > 0) await Session.deleteMany({ _id: { $in: sessions.slice(0, overflow).map((s) => s._id) } });

  const session = await Session.create({
    user: user._id, deviceName: d.deviceName, browser: d.browser, os: d.os, deviceType: d.deviceType, ip: d.ip,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
  });
  const access = signAccess(user._id, session._id);
  const refresh = signRefresh(user._id, session._id);
  session.refreshHash = sha256(refresh);
  await session.save();
  setAuthCookies(res, access, refresh);
  return access;
};

const normEmail = (e) => String(e || '').toLowerCase().trim();
// A cooldown reply would reveal that the email exists, so it is swallowed (the client shows its own timer).
const quietSend = (...a) => sendOtp(...a).catch((e) => { if (e.statusCode !== 429) throw e; });
const GENERIC = 'If that email is registered, a code is on its way';

// ---------- sign up + email verification ----------
exports.register = asyncHandler(async (req, res) => {
  const { name, password } = req.body;
  const email = normEmail(req.body.email);
  let user = await User.findOne({ email }).select('+password');
  if (user?.emailVerified) throw new ApiError(409, 'Email already registered');
  if (user) { user.name = name; user.password = password; await user.save(); } // unverified: nobody owns it yet
  else user = await User.create({ name, email, password, emailVerified: false });

  // Accept any pending project invitations for this email
  const invited = await Project.find({ 'pendingInvites.email': email });
  for (const p of invited) {
    const inv = p.pendingInvites.find((i) => i.email === email);
    if (!p.roleOf(user._id)) p.members.push({ user: user._id, role: inv?.role || 'Member' });
    p.pendingInvites = p.pendingInvites.filter((i) => i.email !== email);
    await p.save();
    await notify(user._id, { type: 'invite', message: `You joined project "${p.name}"`, link: `/projects/${p._id}` });
  }

  await sendOtp(email, 'verify', user.name);
  send(res, { email, needsVerification: true, resendIn: COOLDOWN_SEC }, 'We sent a 6-digit code to your email', 201);
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email);
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(400, 'Incorrect code');
  await checkOtp(email, 'verify', req.body.code);
  user.emailVerified = true;
  await user.save({ validateBeforeSave: false });
  const accessToken = await startSession(req, res, user);
  send(res, { user: publicUser(user), accessToken }, 'Email verified. Welcome to TaskFlow');
});

exports.resendOtp = asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email);
  const purpose = ['verify', 'reset'].includes(req.body.purpose) ? req.body.purpose : 'verify';
  const user = await User.findOne({ email });
  if (user && (purpose !== 'verify' || !user.emailVerified)) await quietSend(email, purpose, user.name);
  send(res, { resendIn: COOLDOWN_SEC }, GENERIC);
});

// ---------- password login ----------
exports.login = asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email);
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(req.body.password))) throw new ApiError(401, 'Invalid email or password');
  if (!user.emailVerified) {
    await sendOtp(email, 'verify', user.name).catch(() => {}); // cooldown may apply; code may already be sent
    return res.status(403).json({ success: false, data: { needsVerification: true, email }, message: 'Verify your email to continue. We sent you a code' });
  }
  const accessToken = await startSession(req, res, user);
  send(res, { user: publicUser(user), accessToken }, 'Welcome back');
});

// ---------- tokens / logout ----------
exports.logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    try { const { sid } = jwt.verify(token, process.env.JWT_REFRESH_SECRET); await Session.deleteOne({ _id: sid }); } catch { /* ignore */ }
  }
  clearAuthCookies(res);
  send(res, null, 'Logged out');
});

exports.refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new ApiError(401, 'No refresh token');
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET); } catch { throw new ApiError(401, 'Refresh token invalid'); }
  const session = await Session.findOne({ _id: payload.sid, user: payload.id }).select('+refreshHash');
  if (!session || session.refreshHash !== sha256(token)) throw new ApiError(401, 'This device was signed out');
  const access = signAccess(payload.id, session._id);
  const refresh = signRefresh(payload.id, session._id);
  session.refreshHash = sha256(refresh);
  session.lastActive = new Date();
  await session.save();
  setAuthCookies(res, access, refresh);
  send(res, { accessToken: access }, 'Token refreshed');
});

// ---------- forgot password: email -> code -> new password ----------
exports.forgotPassword = asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email);
  const user = await User.findOne({ email });
  if (user) await quietSend(email, 'reset', user.name);
  send(res, { email, resendIn: COOLDOWN_SEC }, GENERIC);
});

exports.verifyResetOtp = asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email);
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(400, 'Incorrect code');
  await checkOtp(email, 'reset', req.body.code);
  const raw = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = sha256(raw);
  user.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000);
  await user.save({ validateBeforeSave: false });
  send(res, { resetToken: raw }, 'Code verified. Choose a new password');
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: sha256(req.params.token),
    resetPasswordExpire: { $gt: new Date() },
  }).select('+resetPasswordToken +resetPasswordExpire');
  if (!user) throw new ApiError(400, 'Reset session expired. Start again');
  user.password = req.body.password;
  user.emailVerified = true; // they proved ownership with the emailed code
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();
  await Session.deleteMany({ user: user._id }); // sign out everywhere after a reset
  clearAuthCookies(res);
  send(res, null, 'Password updated. Please log in');
});

// ---------- devices ----------
const shape = (s, current) => ({
  _id: s._id, deviceName: s.deviceName, browser: s.browser, os: s.os, deviceType: s.deviceType, ip: s.ip,
  lastActive: s.lastActive, createdAt: s.createdAt, current: String(s._id) === current,
});

exports.listSessions = asyncHandler(async (req, res) => {
  const sessions = await Session.find({ user: req.user._id }).sort('-lastActive');
  send(res, { max: MAX_DEVICES, devices: sessions.map((s) => shape(s, req.sessionId)) });
});

exports.renameSession = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 40);
  if (!name) throw new ApiError(400, 'Device name cannot be empty');
  const s = await Session.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { deviceName: name }, { new: true });
  if (!s) throw new ApiError(404, 'Device not found');
  send(res, shape(s, req.sessionId), 'Device renamed');
});

exports.removeSession = asyncHandler(async (req, res) => {
  const r = await Session.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!r.deletedCount) throw new ApiError(404, 'Device not found');
  if (req.params.id === req.sessionId) clearAuthCookies(res);
  send(res, null, 'Device signed out');
});

exports.removeOtherSessions = asyncHandler(async (req, res) => {
  const r = await Session.deleteMany({ user: req.user._id, _id: { $ne: req.sessionId } });
  send(res, { removed: r.deletedCount }, 'Signed out of all other devices');
});

exports.publicUser = publicUser;
