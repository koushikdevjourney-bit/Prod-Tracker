const { registerUser, loginUser } = require('../services/auth.service');

function validateCredentials(body, { requireName = false } = {}) {
  const errors = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (requireName && !name) errors.push('Name is required');
  if (!email) errors.push('Email is required');
  else if (!/^\S+@\S+\.\S+$/.test(email)) errors.push('Email is invalid');
  if (!password) errors.push('Password is required');
  else if (password.length < 6) errors.push('Password must be at least 6 characters');

  return { errors, name, email, password };
}

async function register(req, res, next) {
  try {
    const { errors, name, email, password } = validateCredentials(req.body, { requireName: true });
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const result = await registerUser({ name, email, password });
    return res.status(201).json({
      message: 'Registered successfully',
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { errors, email, password } = validateCredentials(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const result = await loginUser({ email, password });
    return res.status(200).json({
      message: 'Logged in successfully',
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  return res.status(200).json({ user: req.user.toSafeObject() });
}

module.exports = { register, login, me };
