// Small models are grouped here and re-exported by individual files for clean imports.
const mongoose = require('mongoose');
const { Schema } = mongoose;

const commentSchema = new Schema(
  {
    task: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['assigned', 'comment', 'reminder', 'invite', 'status', 'system'],
      default: 'system',
    },
    message: { type: String, required: true },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

const activitySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    entity: { type: String, enum: ['task', 'project', 'comment', 'member'], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
  },
  { timestamps: true }
);
activitySchema.index({ entityId: 1, createdAt: -1 });
activitySchema.index({ project: 1, createdAt: -1 });

module.exports = {
  Comment: mongoose.model('Comment', commentSchema),
  Notification: mongoose.model('Notification', notificationSchema),
  ActivityLog: mongoose.model('ActivityLog', activitySchema),
};
