const mongoose = require('mongoose');

const THEMES = ['light', 'dark', 'system'];

const userSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    sleepTargetMinutes: { type: Number, min: 240, max: 840, default: 480 },
    displayName: { type: String, trim: true, maxlength: 80, default: 'You' },
    theme: { type: String, enum: THEMES, default: 'system' },
    hourlyEmailReminders: { type: Boolean, default: true },
    reminderEmail: { type: String, trim: true, lowercase: true, default: 'koushiksai242@gmail.com' },
    reminderStartHour: { type: Number, min: 0, max: 23, default: 8 },
    reminderEndHour: { type: Number, min: 0, max: 23, default: 23 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserSettings', userSettingsSchema);
module.exports.THEMES = THEMES;
