const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Session = require('../models/Session');
const { ApiError, asyncHandler } = require('../utils/helpers');

const protect = asyncHandler(async (req, res, next) => {
  let token = req.cookies?.accessToken;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) token = header.slice(7);
  if (!token) throw new ApiError(401, 'Not authenticated');
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch {
    throw new ApiError(401, 'Token expired or invalid');
  }
  const user = await User.findById(payload.id);
  if (!user) throw new ApiError(401, 'User no longer exists');
  const session = await Session.findOne({ _id: payload.sid, user: user._id });
  if (!session) throw new ApiError(401, 'This device was signed out');
  if (Date.now() - session.lastActive.getTime() > 60000) Session.updateOne({ _id: session._id }, { lastActive: new Date() }).catch(() => {});
  req.user = user;
  req.sessionId = String(session._id);
  next();
});

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const first = errors.array()[0];
  next(new ApiError(400, `${first.msg}`));
};

const notFound = (req, res, next) => next(new ApiError(404, `Route not found: ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Server error';
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = `${Object.keys(err.keyValue || {})[0] || 'Value'} already exists`;
  } else if (err.name === 'MulterError') {
    status = 400;
  }
  if (status === 500) console.error(err);
  res.status(status).json({
    success: false,
    data: process.env.NODE_ENV === 'production' ? null : { stack: status === 500 ? err.stack : undefined },
    message,
  });
};

module.exports = { protect, validate, notFound, errorHandler };
