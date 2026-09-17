const mongoose = require('mongoose');

const ACTIVITY_TYPES = ['productive', 'neutral', 'unproductive', 'sleep'];

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    endDate: { type: String },
    durationMinutes: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    notes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

activitySchema.index({ user: 1, date: 1 });

module.exports = mongoose.model('Activity', activitySchema);
module.exports.ACTIVITY_TYPES = ACTIVITY_TYPES;
