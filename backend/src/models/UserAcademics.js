const mongoose = require('mongoose');

const academicSubSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    done: { type: Boolean, default: false },
    subs: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { _id: false },
);

const academicSubjectSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    stars: { type: Number, min: 1, max: 5, default: 3 },
    subs: { type: [academicSubSchema], default: [] },
  },
  { _id: false },
);

const academicTrackSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    subjects: { type: [academicSubjectSchema], default: [] },
  },
  { _id: false },
);

const userAcademicsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    tracks: { type: [academicTrackSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model('UserAcademics', userAcademicsSchema);
