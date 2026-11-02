const User = require('../models/User');
const { ApiError, asyncHandler, send } = require('../utils/helpers');
const { storeFile } = require('../utils/upload');
const { publicUser } = require('./authController');
const { categoriesFor } = require('../utils/purposes');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const { clearAuthCookies } = require('../utils/helpers');

const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

exports.getMe = asyncHandler(async (req, res) => send(res, publicUser(req.user)));

exports.updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  const b = req.body;

  if (b.name !== undefined) user.name = String(b.name).trim() || user.name;
  if (b.preferences) {
    const p = parse(b.preferences);
    user.preferences = { ...user.preferences.toObject(), ...p, pomodoro: { ...user.preferences.pomodoro.toObject(), ...(p.pomodoro || {}) } };
  }
  if (b.profile) user.profile = { ...user.profile.toObject(), ...parse(b.profile) };
  if (b.purposes) {
    const purposes = parse(b.purposes);
    user.purposes = purposes;
    user.categories = categoriesFor(purposes, user.categories);
  }
  if (b.onboardingCompleted !== undefined) user.onboardingCompleted = b.onboardingCompleted === true || b.onboardingCompleted === 'true';
  if (b.categories) user.categories = parse(b.categories);
  if (b.savedFilters) user.savedFilters = typeof b.savedFilters === 'string' ? JSON.parse(b.savedFilters) : b.savedFilters;
  if (req.file && !/^image\/(png|jpe?g|gif|webp|avif)$/.test(req.file.mimetype)) throw new ApiError(400, 'Profile photo must be a PNG, JPG, GIF or WebP image');
  if (req.file) user.avatar = (await storeFile(req.file, 'taskflow/avatars')).url;
  if (b.removeAvatar === 'true' || b.removeAvatar === true) user.avatar = '';

  if (b.newPassword) {
    if (!b.currentPassword || !(await user.matchPassword(b.currentPassword)))
      throw new ApiError(400, 'Current password is incorrect');
    if (String(b.newPassword).length < 6) throw new ApiError(400, 'New password must be at least 6 characters');
    user.password = b.newPassword;
  }

  await user.save();
  send(res, publicUser(user), 'Profile updated ');
});

// Used to find users to assign (limited fields)
exports.search = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return send(res, []);
  const users = await User.find({ email: new RegExp(`^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') })
    .select('name email avatar')
    .limit(8);
  send(res, users);
});

exports.deleteMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(req.body.password || ''))) throw new ApiError(400, 'Password is incorrect');
  const owned = await Project.find({ owner: user._id }).select('_id');
  const ownedIds = owned.map((p) => p._id);
  const tasks = await Task.find({ $or: [{ createdBy: user._id }, { project: { $in: ownedIds } }] }).select('_id');
  await Promise.all([
    Comment.deleteMany({ $or: [{ user: user._id }, { task: { $in: tasks.map((t) => t._id) } }] }),
    Task.deleteMany({ _id: { $in: tasks.map((t) => t._id) } }),
    Project.deleteMany({ _id: { $in: ownedIds } }),
    Project.updateMany({}, { $pull: { members: { user: user._id } } }),
    Task.updateMany({}, { $pull: { assignees: user._id } }),
    Notification.deleteMany({ user: user._id }),
    user.deleteOne(),
  ]);
  clearAuthCookies(res);
  send(res, null, 'Account deleted');
});
