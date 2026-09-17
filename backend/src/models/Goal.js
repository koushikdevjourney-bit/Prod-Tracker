const mongoose = require('mongoose');

const GOAL_PERIODS = ['daily', 'weekly', 'monthly'];

const goalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, trim: true, maxlength: 80 },
    targetMinutes: { type: Number, required: true, min: 1 },
    date: { type: String, required: true },
    period: { type: String, enum: GOAL_PERIODS, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Goal', goalSchema);
module.exports.GOAL_PERIODS = GOAL_PERIODS;
