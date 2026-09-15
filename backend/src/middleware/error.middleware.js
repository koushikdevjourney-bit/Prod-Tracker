function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === 11000) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
    return res.status(400).json({ message: message || 'Validation failed' });
  }

  const status = err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Internal server error',
  });
}

module.exports = { notFound, errorHandler };
