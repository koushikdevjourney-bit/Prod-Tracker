const mongoose = require('mongoose');

const subtaskSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    done: { type: Boolean, default: false },
  },
  { _id: false },
);

const focusTodoItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 250 },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['urgent', 'high', 'medium', 'low'],
      default: 'medium',
    },
    isPinned: { type: Boolean, default: false },
    category: { type: String, trim: true, maxlength: 80, default: 'General' },
    dueDate: { type: String, trim: true, maxlength: 10, default: '' },
    dueTime: { type: String, trim: true, maxlength: 5, default: '' },
    estimatedMinutes: { type: Number, min: 0, max: 1440, default: 25 },
    loggedMinutes: { type: Number, min: 0, default: 0 },
    subtasks: { type: [subtaskSchema], default: [] },
    completedAt: { type: String, trim: true, default: null },
    createdAt: { type: String, trim: true, default: () => new Date().toISOString() },
    position: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const userFocusTodoSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    todos: { type: [focusTodoItemSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model('UserFocusTodo', userFocusTodoSchema);
