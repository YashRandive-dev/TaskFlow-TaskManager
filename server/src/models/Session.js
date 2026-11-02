const mongoose = require('mongoose');

// One document per signed-in device. Deleting it signs that device out.
const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceName: { type: String, default: 'Unknown device' },
    browser: { type: String, default: '' },
    os: { type: String, default: '' },
    deviceType: { type: String, enum: ['desktop', 'mobile', 'tablet'], default: 'desktop' },
    ip: { type: String, default: '' },
    refreshHash: { type: String, select: false },
    lastActive: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);
