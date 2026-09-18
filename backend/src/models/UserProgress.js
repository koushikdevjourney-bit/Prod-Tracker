const mongoose = require('mongoose');

const progressItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    note: { type: String, trim: true, maxlength: 400, default: '' },
    percent: { type: Number, min: 0, max: 100, default: 0 },
    done: { type: Boolean, default: false },
    position: { type: Number, default: 0, min: 0 },
    source: { type: String, trim: true, maxlength: 80, default: 'Custom' },
    due: { type: String, trim: true, maxlength: 10, default: '' },
    minutes: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

const userProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    intention: { type: String, trim: true, maxlength: 200, default: '' },
    focusMinutesToday: { type: Number, min: 0, default: 0 },
    focusDate: { type: String, trim: true, maxlength: 10, default: '' },
    items: { type: [progressItemSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model('UserProgress', userProgressSchema);
