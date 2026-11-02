const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 10000 },
    status: { type: String, enum: ['todo', 'inprogress', 'review', 'done'], default: 'todo' },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    priorityRank: { type: Number, default: 2 },
    category: { type: String, default: '' },
    tags: [{ type: String, trim: true }],
    dueDate: { type: Date, default: null },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subtasks: [{ title: { type: String, required: true, trim: true }, done: { type: Boolean, default: false } }],
    attachments: [
      {
        name: String,
        url: String,
        size: Number,
        mimeType: String,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    recurring: {
      frequency: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
      spawned: { type: Boolean, default: false },
    },
    estimatedTime: { type: Number, default: 0 }, // minutes
    timeSpent: { type: Number, default: 0 }, // minutes
    position: { type: Number, default: 0 },
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

taskSchema.index({ createdBy: 1 });
taskSchema.index({ assignees: 1 });
taskSchema.index({ project: 1, status: 1, position: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Task', taskSchema);
