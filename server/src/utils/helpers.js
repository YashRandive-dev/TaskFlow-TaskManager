const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const send = (res, data = null, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, data, message: String(message).trim() });

const signAccess = (id, sid) =>
  jwt.sign({ id, sid }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
const signRefresh = (id, sid) =>
  jwt.sign({ id, sid }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d', jwtid: crypto.randomBytes(8).toString('hex') });

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

const cookieOpts = (maxAge) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge,
});

const setAuthCookies = (res, access, refresh) => {
  res.cookie('accessToken', access, cookieOpts(15 * 60 * 1000));
  res.cookie('refreshToken', refresh, cookieOpts(7 * 24 * 60 * 60 * 1000));
};

const clearAuthCookies = (res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = {
  ApiError,
  asyncHandler,
  send,
  signAccess,
  signRefresh,
  sha256,
  setAuthCookies,
  clearAuthCookies,
  escapeRegex,
};
