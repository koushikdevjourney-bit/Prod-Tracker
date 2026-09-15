// Loads local .env when present; on Render, use Dashboard → Environment.
require('dotenv').config();

const app = require('./app');
const { connectDB } = require('./config/db');

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  if (!process.env.JWT_SECRET) {
    console.error(
      'JWT_SECRET is not set. Add it in Render Environment (or backend/.env locally).'
    );
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) {
    console.error(
      'MONGODB_URI is not set. Add it in Render Environment (or backend/.env locally).'
    );
    process.exit(1);
  }

  try {
    await connectDB(process.env.MONGODB_URI);
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API listening on port ${PORT}`);
  });
}

start();
