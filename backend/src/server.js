require('dotenv').config();

const app = require('./app');
const { connectDB } = require('./config/db');

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is missing from .env');
    process.exit(1);
  }

  try {
    await connectDB(process.env.MONGODB_URI);
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

start();
