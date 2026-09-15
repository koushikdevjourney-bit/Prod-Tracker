const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized — token missing' });
    }

    const token = header.slice(7).trim();
    if (!token) {
      return res.status(401).json({ message: 'Not authorized — token missing' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'Server misconfigured — JWT_SECRET missing' });
    }

    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Not authorized — user not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired — please log in again' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Not authorized — invalid token' });
    }
    next(err);
  }
}

module.exports = { protect };
