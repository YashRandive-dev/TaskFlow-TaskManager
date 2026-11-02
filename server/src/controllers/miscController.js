const Task = require('../models/Task');
const Notification = require('../models/Notification');
const { asyncHandler, send, ApiError } = require('../utils/helpers');
const { accessFilter } = require('./taskController');

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------- Analytics ----------
exports.summary = asyncHandler(async (req, res) => {
  // Client's timezone offset (minutes, as from Date#getTimezoneOffset) so "days" match the user's day.
  const offset = Number(req.query.tzOffset) || 0;
  const local = (d) => new Date(new Date(d).getTime() - offset * 60000);
  const key = (d) => { const l = local(d); return `${l.getUTCFullYear()}-${String(l.getUTCMonth() + 1).padStart(2, '0')}-${String(l.getUTCDate()).padStart(2, '0')}`; };

  const base = { $and: [await accessFilter(req.user._id), { isDeleted: false }] };
  const tasks = await Task.find(base).select('status priority dueDate completedAt timeSpent estimatedTime category').lean();

  const now = new Date();
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done');
  const overdue = tasks.filter((t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now).length;
  const todayKey = key(now);
  const dueToday = tasks.filter((t) => t.status !== 'done' && t.dueDate && key(t.dueDate) === todayKey).length;

  const weekly = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const completedKeys = new Map();
  done.forEach((t) => { if (t.completedAt) completedKeys.set(key(t.completedAt), (completedKeys.get(key(t.completedAt)) || 0) + 1); });
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const k = key(d);
    weekly.push({ day: dayNames[local(d).getUTCDay()], date: k, completed: completedKeys.get(k) || 0 });
  }

  // Streak: consecutive days (ending today or yesterday) with at least one completed task
  let current = 0;
  let cursor = new Date(now);
  if (!completedKeys.has(key(cursor))) cursor = new Date(cursor.getTime() - 86400000);
  while (completedKeys.has(key(cursor))) { current++; cursor = new Date(cursor.getTime() - 86400000); }
  const sorted = [...completedKeys.keys()].sort();
  let longest = 0, run = 0, prev = null;
  sorted.forEach((k) => {
    const d = new Date(`${k}T00:00:00Z`).getTime();
    run = prev !== null && d - prev === 86400000 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  });

  const count = (field, values) => values.map((v) => ({ name: v, value: tasks.filter((t) => t[field] === v).length }));
  send(res, {
    total,
    completed: done.length,
    inProgress: tasks.filter((t) => t.status === 'inprogress').length,
    completionRate: total ? Math.round((done.length / total) * 100) : 0,
    overdue,
    dueToday,
    completedThisWeek: weekly.reduce((a, d) => a + d.completed, 0),
    weekly,
    byPriority: count('priority', ['high', 'medium', 'low']),
    byStatus: count('status', ['todo', 'inprogress', 'review', 'done']),
    streak: { current, longest: Math.max(longest, current) },
    timeSpent: tasks.reduce((a, t) => a + (t.timeSpent || 0), 0),
  });
});

// ---------- Notifications ----------
exports.listNotifications = asyncHandler(async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).sort('-createdAt').limit(100),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  send(res, { notifications: items, unread });
});

exports.markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true }, { new: true });
  if (!n) throw new ApiError(404, 'Notification not found');
  send(res, n);
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  send(res, null, 'All caught up ');
});

exports.clearAll = asyncHandler(async (req, res) => {
  await Notification.deleteMany({ user: req.user._id });
  send(res, null, 'Notifications cleared');
});

exports.dayKey = dayKey;
