const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const defaultCategories = () => [{ name: 'Personal', icon: 'home' }];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    avatar: { type: String, default: '' },
    // Defaults to true so accounts that existed before email verification was added keep working; register() sets false for new sign-ups.
    emailVerified: { type: Boolean, default: true },
    preferences: {
      theme: { type: String, enum: ['light', 'dark'], default: 'light' },
      emailReminders: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: false },
      inAppNotifications: { type: Boolean, default: true },
      timezone: { type: String, default: '' },
      weekStart: { type: String, enum: ['sunday', 'monday'], default: 'monday' },
      timeFormat: { type: String, enum: ['12h', '24h'], default: '12h' },
      defaultView: { type: String, enum: ['kanban', 'list', 'calendar'], default: 'list' },
      defaultPriority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
      dailyGoal: { type: Number, default: 5, min: 1, max: 50 },
      weeklyDigest: { type: Boolean, default: false },
      pomodoro: {
        work: { type: Number, default: 25 },
        shortBreak: { type: Number, default: 5 },
        longBreak: { type: Number, default: 15 },
      },
    },
    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastDate: { type: String, default: '' },
    },
    categories: { type: [{ _id: false, name: String, icon: { type: String, default: 'tag' } }], default: defaultCategories },
    purposes: [{ type: String, enum: ['work', 'study', 'health', 'shopping', 'personal'] }],
    onboardingCompleted: { type: Boolean, default: false },
    profile: {
      jobTitle: { type: String, default: '', maxlength: 80 },
      company: { type: String, default: '', maxlength: 80 },
      phone: { type: String, default: '', maxlength: 30 },
      location: { type: String, default: '', maxlength: 80 },
      bio: { type: String, default: '', maxlength: 300 },
      website: { type: String, default: '', maxlength: 120 },
    },
    savedFilters: [{ name: String, filters: mongoose.Schema.Types.Mixed }],
    refreshTokenHash: { type: String, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hash(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = function matchPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
