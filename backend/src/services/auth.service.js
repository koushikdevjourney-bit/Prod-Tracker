const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ id: userId }, secret, { expiresIn });
}

async function registerUser({ name, email, password }) {
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    const error = new Error('Email already registered');
    error.statusCode = 409;
    throw error;
  }

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
  });

  const token = signToken(user._id);
  return { user: user.toSafeObject(), token };
}

async function loginUser({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const match = await user.comparePassword(password);
  if (!match) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const token = signToken(user._id);
  return { user: user.toSafeObject(), token };
}

module.exports = {
  registerUser,
  loginUser,
  signToken,
};
