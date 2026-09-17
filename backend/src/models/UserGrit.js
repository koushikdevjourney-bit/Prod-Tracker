const mongoose = require('mongoose');

const GRIT_RESULTS = ['none', 'gold', 'silver', 'retry'];
const GRIT_TARGETS = ['gold', 'silver'];

const gritRowSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, maxlength: 80 },
    level: { type: Number, required: true, min: 1, max: 10 },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    result: { type: String, enum: GRIT_RESULTS, default: 'none' },
    target: { type: String, enum: GRIT_TARGETS, default: 'gold' },
    inClimb: { type: Boolean, default: false },
    position: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const userGritSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    rows: { type: [gritRowSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model('UserGrit', userGritSchema);
module.exports.GRIT_RESULTS = GRIT_RESULTS;
module.exports.GRIT_TARGETS = GRIT_TARGETS;
