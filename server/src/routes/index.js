const express = require('express');
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { protect, validate } = require('../middleware');
const { upload } = require('../utils/upload');
const auth = require('../controllers/authController');
const users = require('../controllers/userController');
const tasks = require('../controllers/taskController');
const projects = require('../controllers/projectController');
const misc = require('../controllers/miscController');

const api = express.Router();

// ---------- Auth ----------
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: Number(process.env.AUTH_RATE_LIMIT) || 40, standardHeaders: true, legacyHeaders: false, message: { success: false, data: null, message: 'Too many attempts, try again later' } });
const r = express.Router();
const emailRule = body('email').isEmail().withMessage('Valid email required').normalizeEmail();
const codeRule = body('code').trim().isLength({ min: 6, max: 6 }).withMessage('Enter the 6-digit code').isNumeric().withMessage('Code must be numeric');
r.post('/register', authLimiter,
  body('name').trim().notEmpty().withMessage('Name is required'),
  emailRule,
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate, auth.register);
r.post('/verify-email', authLimiter, emailRule, codeRule, validate, auth.verifyEmail);
r.post('/resend-otp', authLimiter, emailRule, validate, auth.resendOtp);
r.post('/login', authLimiter, emailRule, body('password').notEmpty().withMessage('Password required'), validate, auth.login);
r.post('/logout', auth.logout);
r.post('/refresh', auth.refresh);
r.post('/forgot-password', authLimiter, emailRule, validate, auth.forgotPassword);
r.post('/verify-reset-otp', authLimiter, emailRule, codeRule, validate, auth.verifyResetOtp);
r.post('/reset-password/:token', authLimiter, body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'), validate, auth.resetPassword);
r.get('/sessions', protect, auth.listSessions);
r.delete('/sessions', protect, auth.removeOtherSessions);
r.patch('/sessions/:id', protect, auth.renameSession);
r.delete('/sessions/:id', protect, auth.removeSession);
api.use('/auth', r);

// ---------- Users ----------
api.get('/users/me', protect, users.getMe);
api.put('/users/me', protect, upload.single('avatar'), users.updateMe);
api.get('/users/search', protect, users.search);
api.delete('/users/me', protect, users.deleteMe);

// ---------- Tasks ----------
const t = express.Router();
t.use(protect);
const taskRules = [
  body('title').optional().trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('priority').optional().isIn(['high', 'medium', 'low']).withMessage('Invalid priority'),
  body('status').optional().isIn(['todo', 'inprogress', 'review', 'done']).withMessage('Invalid status'),
  body('recurring').optional().isIn(['none', 'daily', 'weekly', 'monthly']).withMessage('Invalid recurrence'),
];
t.get('/', tasks.list);
t.post('/', body('title').trim().notEmpty().withMessage('Title is required'), ...taskRules, validate, tasks.create);
t.patch('/reorder', tasks.reorder);
t.get('/export', tasks.exportTasks);
t.delete('/trash/empty', tasks.emptyTrash);
t.get('/:id', param('id').isMongoId(), validate, tasks.get);
t.put('/:id', param('id').isMongoId(), ...taskRules, validate, tasks.update);
t.delete('/:id', param('id').isMongoId(), validate, tasks.remove);
t.patch('/:id/status', body('status').isIn(['todo', 'inprogress', 'review', 'done']).withMessage('Invalid status'), validate, tasks.updateStatus);
t.patch('/:id/archive', tasks.archive);
t.patch('/:id/restore', tasks.restore);
t.patch('/:id/time', tasks.addTime);
t.get('/:id/comments', tasks.getComments);
t.post('/:id/comments', body('text').trim().notEmpty().withMessage('Comment cannot be empty'), validate, tasks.addComment);
t.post('/:id/attachments', upload.array('files', 5), tasks.addAttachments);
t.delete('/:id/attachments/:attachmentId', tasks.removeAttachment);
t.get('/:id/activity', tasks.activity);
api.use('/tasks', t);

// ---------- Projects ----------
const p = express.Router();
p.use(protect);
p.get('/', projects.list);
p.post('/', body('name').trim().notEmpty().withMessage('Project name is required'), validate, projects.create);
p.get('/:id', param('id').isMongoId(), validate, projects.get);
p.put('/:id', param('id').isMongoId(), validate, projects.update);
p.delete('/:id', param('id').isMongoId(), validate, projects.remove);
p.post('/:id/invite', body('email').isEmail().withMessage('Valid email required'), validate, projects.invite);
p.put('/:id/members/:userId', projects.updateMember);
p.delete('/:id/members/:userId', projects.removeMember);
p.get('/:id/activity', projects.activity);
api.use('/projects', p);

// ---------- Analytics & Notifications ----------
api.get('/analytics/summary', protect, misc.summary);
api.get('/notifications', protect, misc.listNotifications);
api.patch('/notifications/read-all', protect, misc.markAllRead);
api.patch('/notifications/:id', protect, misc.markRead);
api.delete('/notifications', protect, misc.clearAll);

module.exports = api;
