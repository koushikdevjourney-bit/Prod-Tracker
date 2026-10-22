const mongoose = require('mongoose');

const cardItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, maxlength: 80 },
    cardCategory: { type: String, enum: ['personal', 'others'], default: 'personal' },
    cardType: { type: String, enum: ['credit', 'debit'], default: 'credit' },
    belongsTo: { type: String, trim: true, maxlength: 100, default: '' },
    cardholderName: { type: String, trim: true, maxlength: 100, default: '' },
    bankName: { type: String, trim: true, maxlength: 100, default: '' },
    nickname: { type: String, trim: true, maxlength: 100, default: '' },
    cardNumber: { type: String, trim: true, maxlength: 30, default: '' },
    expiryMonth: { type: String, trim: true, maxlength: 2, default: '' },
    expiryYear: { type: String, trim: true, maxlength: 4, default: '' },
    cvv: { type: String, trim: true, maxlength: 6, default: '' },
    network: {
      type: String,
      enum: ['visa', 'mastercard', 'rupay', 'amex', 'discover', 'other'],
      default: 'visa',
    },
    theme: { type: String, trim: true, maxlength: 50, default: 'midnight' },
    billingDate: { type: String, trim: true, maxlength: 50, default: '' },
    dueDate: { type: String, trim: true, maxlength: 50, default: '' },
    creditLimit: { type: String, trim: true, maxlength: 50, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    isFavorite: { type: Boolean, default: false },
    createdAt: { type: String, trim: true, default: () => new Date().toISOString() },
  },
  { _id: false },
);

const userCardSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    cards: { type: [cardItemSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model('UserCard', userCardSchema);
