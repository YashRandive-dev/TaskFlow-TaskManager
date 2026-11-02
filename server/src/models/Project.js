const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 500 },
    color: { type: String, default: '#3B6EA8' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['Owner', 'Admin', 'Member'], default: 'Member' },
      },
    ],
    pendingInvites: [{ _id: false, email: String, role: { type: String, default: 'Member' } }],
  },
  { timestamps: true }
);

projectSchema.index({ 'members.user': 1 });
projectSchema.index({ owner: 1 });

projectSchema.methods.roleOf = function roleOf(userId) {
  const m = this.members.find((x) => String(x.user?._id || x.user) === String(userId));
  return m ? m.role : null;
};

module.exports = mongoose.model('Project', projectSchema);
