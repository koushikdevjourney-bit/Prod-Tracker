const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    targetDaysPerWeek: { type: Number, required: true, min: 1, max: 7 },
    completedDates: { type: [String], default: [] },
    color: { type: String, trim: true, maxlength: 32, default: '#0d9488' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Habit', habitSchema);
