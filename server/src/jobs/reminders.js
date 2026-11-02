const cron = require('node-cron');
const Task = require('../models/Task');
const { notify } = require('../utils/notify');
const { sendEmail } = require('../utils/email');

const runReminders = async () => {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tasks = await Task.find({
    dueDate: { $gt: now, $lte: soon },
    status: { $ne: 'done' },
    isDeleted: false,
    isArchived: false,
    reminderSent: false,
  }).populate('assignees createdBy', 'name email preferences');

  for (const task of tasks) {
    const people = new Map();
    [task.createdBy, ...task.assignees].filter(Boolean).forEach((u) => people.set(String(u._id), u));
    for (const u of people.values()) {
      await notify(u._id, { type: 'reminder', message: `"${task.title}" is due within 24 hours`, link: `/tasks?open=${task._id}` });
      if (u.preferences?.emailReminders !== false) {
        await sendEmail({
          to: u.email,
          subject: `Reminder: "${task.title}" is due soon`,
          title: 'Task due within 24 hours',
          body: `Hi ${u.name}, <b>${task.title}</b> is due on ${task.dueDate.toLocaleString()}. You've got this! `,
          cta: { url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/tasks?open=${task._id}`, label: 'Open task' },
        });
      }
    }
    task.reminderSent = true;
    await task.save();
  }
  if (tasks.length) console.log(`Sent reminders for ${tasks.length} task(s)`);
};

const startReminderJob = () => {
  cron.schedule('*/15 * * * *', () => runReminders().catch((e) => console.error('reminder job failed', e.message)));
};

module.exports = { startReminderJob, runReminders };
