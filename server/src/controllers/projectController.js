const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { ApiError, asyncHandler, send } = require('../utils/helpers');
const { notify, logActivity } = require('../utils/notify');
const { sendEmail } = require('../utils/email');
const { escapeHtml } = require('../utils/helpers');
const { emitToUsers, emitToProject, leaveProjectRoom, joinProjectRoom } = require('../sockets');

const POP = [
  { path: 'members.user', select: 'name email avatar' },
  { path: 'owner', select: 'name email avatar' },
];

const load = async (id, user, minRole) => {
  const p = await Project.findById(id);
  if (!p) throw new ApiError(404, 'Project not found');
  const role = p.roleOf(user._id);
  if (!role) throw new ApiError(403, 'You are not a member of this project');
  if (minRole === 'Admin' && role === 'Member') throw new ApiError(403, 'Admins only');
  if (minRole === 'Owner' && role !== 'Owner') throw new ApiError(403, 'Owner only');
  return { project: p, role };
};

exports.list = asyncHandler(async (req, res) => {
  const projects = await Project.find({ 'members.user': req.user._id }).sort('-updatedAt').populate(POP).lean();
  const counts = await Task.aggregate([
    { $match: { project: { $in: projects.map((p) => p._id) }, isDeleted: false } },
    { $group: { _id: '$project', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } } } },
  ]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c]));
  send(res, projects.map((p) => ({
    ...p,
    myRole: p.members.find((m) => String(m.user._id) === String(req.user._id))?.role,
    taskCount: map[String(p._id)]?.total || 0,
    doneCount: map[String(p._id)]?.done || 0,
  })));
});

exports.get = asyncHandler(async (req, res) => {
  const { project, role } = await load(req.params.id, req.user);
  await project.populate(POP);
  send(res, { ...project.toObject(), myRole: role });
});

exports.create = asyncHandler(async (req, res) => {
  const { name, description, color } = req.body;
  const project = await Project.create({
    name, description, color: color || '#3B6EA8',
    owner: req.user._id, members: [{ user: req.user._id, role: 'Owner' }],
  });
  await logActivity({ user: req.user._id, action: `created project "${name}"`, entity: 'project', entityId: project._id, project: project._id });
  await project.populate(POP);
  send(res, { ...project.toObject(), myRole: 'Owner', taskCount: 0, doneCount: 0 }, 'Project created', 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { project } = await load(req.params.id, req.user, 'Admin');
  ['name', 'description', 'color'].forEach((k) => {
    if (req.body[k] !== undefined) project[k] = req.body[k];
  });
  await project.save();
  await project.populate(POP);
  send(res, project, 'Project updated');
});

exports.remove = asyncHandler(async (req, res) => {
  const { project } = await load(req.params.id, req.user, 'Owner');
  await Task.deleteMany({ project: project._id });
  await project.deleteOne();
  send(res, { id: project._id }, 'Project deleted');
});

exports.invite = asyncHandler(async (req, res) => {
  const { project } = await load(req.params.id, req.user, 'Admin');
  const email = String(req.body.email).toLowerCase().trim();
  const role = req.body.role === 'Admin' ? 'Admin' : 'Member';
  const target = await User.findOne({ email });

  if (target) {
    if (project.roleOf(target._id)) throw new ApiError(409, 'Already a member');
    project.members.push({ user: target._id, role });
    await project.save();
    await notify(target._id, { type: 'invite', message: `${req.user.name} added you to "${project.name}"`, link: `/projects/${project._id}` });
    emitToUsers([target._id], 'project:joined', { projectId: project._id });
    joinProjectRoom(target._id, project._id);
    await logActivity({ user: req.user._id, action: `invited ${target.name} as ${role}`, entity: 'member', entityId: project._id, project: project._id });
  } else {
    if (!project.pendingInvites.some((i) => i.email === email)) project.pendingInvites.push({ email, role });
    await project.save();
    await sendEmail({
      to: email,
      subject: `${req.user.name} invited you to "${project.name}" on TaskFlow`,
      title: "You're invited!",
      body: `${escapeHtml(req.user.name)} invited you to join the project <b>${escapeHtml(project.name)}</b>. Create a free account with this email address to join automatically.`,
      cta: { url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/register`, label: 'Join TaskFlow' },
    });
  }
  await project.populate(POP);
  emitToProject(project._id, 'project:updated', { project });
  send(res, project, target ? `${target.name} added` : 'Invitation emailed', 201);
});

exports.updateMember = asyncHandler(async (req, res) => {
  const { project } = await load(req.params.id, req.user, 'Owner');
  const m = project.members.find((x) => String(x.user) === req.params.userId);
  if (!m) throw new ApiError(404, 'Member not found');
  if (m.role === 'Owner') throw new ApiError(400, 'Cannot change the owner role');
  m.role = req.body.role === 'Admin' ? 'Admin' : 'Member';
  await project.save();
  await project.populate(POP);
  send(res, project, 'Role updated');
});

exports.removeMember = asyncHandler(async (req, res) => {
  const { project, role } = await load(req.params.id, req.user);
  const targetId = req.params.userId;
  const self = String(req.user._id) === targetId;
  if (!self && role === 'Member') throw new ApiError(403, 'Admins only');
  const m = project.members.find((x) => String(x.user) === targetId);
  if (!m) throw new ApiError(404, 'Member not found');
  if (m.role === 'Owner') throw new ApiError(400, 'The owner cannot be removed');
  project.members = project.members.filter((x) => String(x.user) !== targetId);
  await project.save();
  await Task.updateMany({ project: project._id }, { $pull: { assignees: targetId } });
  leaveProjectRoom(targetId, project._id);
  await project.populate(POP);
  send(res, project, self ? 'You left the project' : 'Member removed');
});

exports.activity = asyncHandler(async (req, res) => {
  await load(req.params.id, req.user);
  send(res, await ActivityLog.find({ project: req.params.id }).sort('-createdAt').limit(60).populate('user', 'name avatar'));
});
