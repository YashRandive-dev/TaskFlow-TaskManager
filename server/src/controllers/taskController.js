const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const Comment = require('../models/Comment');
const ActivityLog = require('../models/ActivityLog');
const { ApiError, asyncHandler, send, escapeRegex } = require('../utils/helpers');
const { notify, notifyMany, logActivity } = require('../utils/notify');
const { broadcastTask } = require('../sockets');
const { storeFile } = require('../utils/upload');

const RANK = { high: 3, medium: 2, low: 1 };
const STATUS_LABEL = { todo: 'To Do', inprogress: 'In Progress', review: 'Review', done: 'Done' };
const POP = [
  { path: 'assignees', select: 'name email avatar' },
  { path: 'createdBy', select: 'name avatar' },
  { path: 'project', select: 'name color' },
];

const accessFilter = async (userId) => {
  const projects = await Project.find({ 'members.user': userId }).select('_id');
  return {
    $or: [{ createdBy: userId }, { assignees: userId }, { project: { $in: projects.map((p) => p._id) } }],
  };
};

const loadTask = async (id, user) => {
  const task = await Task.findById(id);
  if (!task) throw new ApiError(404, 'Task not found');
  const f = await accessFilter(user._id);
  const ok = await Task.exists({ _id: id, ...f });
  if (!ok) throw new ApiError(403, 'You do not have access to this task');
  return task;
};

const populated = (id) => Task.findById(id).populate(POP);

const nextDue = (date, freq) => {
  const d = new Date(date || Date.now());
  if (freq === 'daily') d.setDate(d.getDate() + 1);
  if (freq === 'weekly') d.setDate(d.getDate() + 7);
  if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  return d;
};

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const bumpStreak = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;
  const today = dayKey(new Date());
  if (user.streak.lastDate === today) return;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  user.streak.current = user.streak.lastDate === dayKey(y) ? user.streak.current + 1 : 1;
  user.streak.longest = Math.max(user.streak.longest, user.streak.current);
  user.streak.lastDate = today;
  await user.save();
};

/** Shared status transition: completion timestamp, recurrence, streak, notifications. */
const applyStatus = async (task, status, actor) => {
  if (task.status === status) return;
  const was = task.status;
  task.status = status;
  if (status === 'done') {
    task.completedAt = new Date();
    await bumpStreak(actor._id);
    const freq = task.recurring?.frequency;
    if (freq && freq !== 'none' && !task.recurring.spawned) {
      task.recurring.spawned = true;
      const copy = await Task.create({
        title: task.title, description: task.description, priority: task.priority, priorityRank: task.priorityRank,
        category: task.category, tags: task.tags, project: task.project, assignees: task.assignees,
        createdBy: task.createdBy, estimatedTime: task.estimatedTime,
        subtasks: task.subtasks.map((s) => ({ title: s.title, done: false })),
        recurring: { frequency: freq, spawned: false },
        dueDate: nextDue(task.dueDate, freq), position: Date.now(),
      });
      broadcastTask(copy, 'task:created', { task: await populated(copy._id), actorId: actor._id });
    }
  } else if (was === 'done') {
    task.completedAt = null;
  }
  await logActivity({
    user: actor._id, action: `moved "${task.title}" to ${STATUS_LABEL[status]}`, entity: 'task',
    entityId: task._id, project: task.project,
  });
  await notifyMany(
    [task.createdBy, ...task.assignees],
    { type: 'status', message: `${STATUS_LABEL[status]} · "${task.title}" moved by ${actor.name}`, link: `/tasks?open=${task._id}` },
    actor._id
  );
};

const listFilter = async (req) => {
  // Query values must be plain strings; objects (e.g. ?search[$ne]=x) are dropped.
  const q = Object.fromEntries(Object.entries(req.query).map(([k, v]) => [k, Array.isArray(v) ? v.filter((x) => typeof x === 'string').join(',') : typeof v === 'string' ? v : '']));
  const and = [await accessFilter(req.user._id)];
  if (q.trash === 'true') and.push({ isDeleted: true });
  else {
    and.push({ isDeleted: false });
    and.push({ isArchived: q.archived === 'true' });
  }
  if (q.status) and.push({ status: { $in: String(q.status).split(',') } });
  if (q.priority) and.push({ priority: { $in: String(q.priority).split(',') } });
  if (q.category) and.push({ category: { $in: String(q.category).split(',') } });
  if (q.project === 'none') and.push({ project: null });
  else if (q.project) and.push({ project: q.project });
  if (q.assignee === 'me') and.push({ assignees: req.user._id });
  else if (q.assignee) and.push({ assignees: q.assignee });
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search.trim()), 'i');
    and.push({ $or: [{ title: rx }, { description: rx }, { tags: rx }] });
  }
  const range = {};
  if (q.from) range.$gte = new Date(q.from);
  if (q.to) range.$lte = new Date(q.to);
  if (q.due === 'today') {
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const e = new Date(); e.setHours(23, 59, 59, 999);
    range.$gte = s; range.$lte = e;
  } else if (q.due === 'overdue') {
    range.$lt = new Date();
    and.push({ status: { $ne: 'done' } });
  }
  if (Object.keys(range).length) and.push({ dueDate: range });
  return { $and: and };
};

exports.list = asyncHandler(async (req, res) => {
  const filter = await listFilter(req);
  const sortKey = { dueDate: 'dueDate', priority: 'priorityRank', createdAt: 'createdAt', title: 'title', position: 'position' }[req.query.sort] || 'position';
  const dir = req.query.order === 'desc' ? -1 : 1;
  const sort = { [sortKey]: dir, createdAt: -1 };
  if (sortKey === 'dueDate') sort.dueDate = dir; // nulls sort first in asc; acceptable
  const limit = Math.min(Number(req.query.limit) || 300, 500);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const [tasks, total] = await Promise.all([
    Task.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate(POP),
    Task.countDocuments(filter),
  ]);
  send(res, { tasks, total, page, pages: Math.ceil(total / limit) || 1 });
});

exports.create = asyncHandler(async (req, res) => {
  const b = req.body;
  if (b.project) {
    const p = await Project.findById(b.project);
    if (!p || !p.roleOf(req.user._id)) throw new ApiError(403, 'Not a member of that project');
  }
  const status = b.status || 'todo';
  const last = await Task.findOne({ createdBy: req.user._id, status }).sort({ position: -1 }).select('position');
  const task = await Task.create({
    title: b.title, description: b.description, status, priority: b.priority || 'medium',
    priorityRank: RANK[b.priority || 'medium'], category: b.category || '', tags: b.tags || [],
    dueDate: b.dueDate || null, project: b.project || null, assignees: b.assignees || [],
    createdBy: req.user._id, subtasks: b.subtasks || [], recurring: { frequency: b.recurring || 'none' },
    estimatedTime: b.estimatedTime || 0, position: (last?.position || 0) + 1024,
    completedAt: status === 'done' ? new Date() : null,
  });
  await logActivity({ user: req.user._id, action: `created "${task.title}"`, entity: 'task', entityId: task._id, project: task.project });
  await notifyMany(task.assignees, { type: 'assigned', message: `${req.user.name} assigned you "${task.title}"`, link: `/tasks?open=${task._id}` }, req.user._id);
  const full = await populated(task._id);
  broadcastTask(task, 'task:created', { task: full, actorId: req.user._id });
  send(res, full, 'Task created', 201);
});

exports.get = asyncHandler(async (req, res) => {
  await loadTask(req.params.id, req.user);
  send(res, await populated(req.params.id));
});

exports.update = asyncHandler(async (req, res) => {
  const task = await loadTask(req.params.id, req.user);
  const b = req.body;
  const before = task.assignees.map(String);
  ['title', 'description', 'category', 'tags', 'dueDate', 'subtasks', 'estimatedTime', 'timeSpent'].forEach((k) => {
    if (b[k] !== undefined) task[k] = b[k];
  });
  if (b.dueDate !== undefined) task.reminderSent = false;
  if (b.priority) { task.priority = b.priority; task.priorityRank = RANK[b.priority]; }
  if (b.recurring !== undefined) task.recurring.frequency = b.recurring;
  if (b.project !== undefined) {
    if (b.project) {
      const p = await Project.findById(b.project);
      if (!p || !p.roleOf(req.user._id)) throw new ApiError(403, 'Not a member of that project');
    }
    task.project = b.project || null;
  }
  if (b.assignees) task.assignees = b.assignees;
  if (b.status) await applyStatus(task, b.status, req.user);
  await task.save();

  const added = task.assignees.map(String).filter((id) => !before.includes(id));
  await notifyMany(added, { type: 'assigned', message: `${req.user.name} assigned you "${task.title}"`, link: `/tasks?open=${task._id}` }, req.user._id);
  await logActivity({ user: req.user._id, action: `updated "${task.title}"`, entity: 'task', entityId: task._id, project: task.project });
  const full = await populated(task._id);
  broadcastTask(task, 'task:updated', { task: full, actorId: req.user._id, actorName: req.user.name });
  send(res, full, 'Task updated');
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const task = await loadTask(req.params.id, req.user);
  const { status, position } = req.body;
  await applyStatus(task, status, req.user);
  if (position !== undefined) task.position = position;
  await task.save();
  const full = await populated(task._id);
  broadcastTask(task, 'task:moved', { task: full, actorId: req.user._id, actorName: req.user.name });
  send(res, full, status === 'done' ? 'Task completed' : 'Status updated');
});

exports.reorder = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return send(res, null, 'Nothing to reorder');
  const f = await accessFilter(req.user._id);
  await Task.bulkWrite(
    items.map((i) => ({ updateOne: { filter: { _id: i.id, ...f }, update: { $set: { position: Number(i.position) } } } }))
  );
  const tasks = await Task.find({ _id: { $in: items.map((i) => i.id) } }).select('createdBy assignees project');
  tasks.forEach((t) => broadcastTask(t, 'task:reordered', { items, actorId: req.user._id }));
  send(res, null, 'Order saved');
});

exports.archive = asyncHandler(async (req, res) => {
  const task = await loadTask(req.params.id, req.user);
  task.isArchived = req.body.archived !== false;
  await task.save();
  const full = await populated(task._id);
  broadcastTask(task, 'task:updated', { task: full, actorId: req.user._id });
  send(res, full, task.isArchived ? 'Task archived' : 'Task unarchived');
});

exports.remove = asyncHandler(async (req, res) => {
  const task = await loadTask(req.params.id, req.user);
  if (req.query.permanent === 'true') {
    await Promise.all([task.deleteOne(), Comment.deleteMany({ task: task._id })]);
    broadcastTask(task, 'task:deleted', { id: task._id, actorId: req.user._id });
    return send(res, { id: task._id }, 'Task permanently deleted');
  }
  task.isDeleted = true;
  task.deletedAt = new Date();
  await task.save();
  await logActivity({ user: req.user._id, action: `deleted "${task.title}"`, entity: 'task', entityId: task._id, project: task.project });
  broadcastTask(task, 'task:deleted', { id: task._id, actorId: req.user._id, actorName: req.user.name });
  send(res, { id: task._id }, 'Task deleted');
});

exports.restore = asyncHandler(async (req, res) => {
  const task = await loadTask(req.params.id, req.user);
  task.isDeleted = false;
  task.deletedAt = null;
  task.isArchived = false;
  await task.save();
  const full = await populated(task._id);
  broadcastTask(task, 'task:created', { task: full, actorId: req.user._id });
  send(res, full, 'Task restored');
});

exports.emptyTrash = asyncHandler(async (req, res) => {
  const r = await Task.deleteMany({ createdBy: req.user._id, isDeleted: true });
  send(res, { deleted: r.deletedCount }, 'Trash emptied');
});

exports.addTime = asyncHandler(async (req, res) => {
  const task = await loadTask(req.params.id, req.user);
  const minutes = Number(req.body.minutes);
  if (!(minutes > 0)) throw new ApiError(400, 'minutes must be positive');
  task.timeSpent += minutes;
  await task.save();
  const full = await populated(task._id);
  broadcastTask(task, 'task:updated', { task: full, actorId: req.user._id });
  send(res, full, `Logged ${minutes} min`);
});

exports.getComments = asyncHandler(async (req, res) => {
  await loadTask(req.params.id, req.user);
  send(res, await Comment.find({ task: req.params.id }).sort('createdAt').populate('user', 'name avatar'));
});

exports.addComment = asyncHandler(async (req, res) => {
  const task = await loadTask(req.params.id, req.user);
  const c = await Comment.create({ task: task._id, user: req.user._id, text: req.body.text });
  const full = await c.populate('user', 'name avatar');
  await logActivity({ user: req.user._id, action: `commented on "${task.title}"`, entity: 'comment', entityId: task._id, project: task.project });
  await notifyMany([task.createdBy, ...task.assignees], { type: 'comment', message: `${req.user.name} commented on "${task.title}"`, link: `/tasks?open=${task._id}` }, req.user._id);
  broadcastTask(task, 'comment:added', { taskId: task._id, comment: full, actorId: req.user._id, actorName: req.user.name, title: task.title });
  send(res, full, 'Comment added', 201);
});

exports.addAttachments = asyncHandler(async (req, res) => {
  const task = await loadTask(req.params.id, req.user);
  if (!req.files?.length) throw new ApiError(400, 'No files uploaded');
  for (const f of req.files) {
    const stored = await storeFile(f, 'taskflow/attachments');
    task.attachments.push({ ...stored, uploadedBy: req.user._id });
  }
  await task.save();
  await logActivity({ user: req.user._id, action: `attached ${req.files.length} file(s) to "${task.title}"`, entity: 'task', entityId: task._id, project: task.project });
  const full = await populated(task._id);
  broadcastTask(task, 'task:updated', { task: full, actorId: req.user._id });
  send(res, full, 'Attachment uploaded', 201);
});

exports.removeAttachment = asyncHandler(async (req, res) => {
  const task = await loadTask(req.params.id, req.user);
  task.attachments.pull(req.params.attachmentId);
  await task.save();
  const full = await populated(task._id);
  broadcastTask(task, 'task:updated', { task: full, actorId: req.user._id });
  send(res, full, 'Attachment removed');
});

exports.activity = asyncHandler(async (req, res) => {
  await loadTask(req.params.id, req.user);
  send(res, await ActivityLog.find({ entityId: req.params.id }).sort('-createdAt').limit(50).populate('user', 'name avatar'));
});

exports.exportTasks = asyncHandler(async (req, res) => {
  const filter = await listFilter({ ...req, query: { ...req.query, archived: undefined } });
  const tasks = await Task.find(filter).sort('-createdAt').populate(POP).lean();
  if (req.query.format === 'json') {
    res.setHeader('Content-Disposition', 'attachment; filename="taskflow-tasks.json"');
    return res.json(tasks);
  }
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Title', 'Status', 'Priority', 'Category', 'Tags', 'Due Date', 'Project', 'Assignees', 'Subtasks Done', 'Estimated (min)', 'Spent (min)', 'Created', 'Completed'];
  const rows = tasks.map((t) => [
    t.title, t.status, t.priority, t.category, (t.tags || []).join(' '), t.dueDate ? new Date(t.dueDate).toISOString() : '',
    t.project?.name || '', (t.assignees || []).map((a) => a.name).join('; '),
    `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}`, t.estimatedTime, t.timeSpent,
    new Date(t.createdAt).toISOString(), t.completedAt ? new Date(t.completedAt).toISOString() : '',
  ].map(esc).join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="taskflow-tasks.csv"');
  res.send([header.map(esc).join(','), ...rows].join('\n'));
});

exports.accessFilter = accessFilter;
exports.notifyAssignedOnly = notify;
