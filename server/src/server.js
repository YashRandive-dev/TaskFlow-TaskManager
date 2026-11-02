require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const { initSocket } = require('./sockets');
const { startReminderJob } = require('./jobs/reminders');

const PORT = process.env.PORT || 5001;

(async () => {
  try {
    if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set (see .env.example)');
    }
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taskflow');
    console.log('MongoDB connected');
    const server = http.createServer(app);
    initSocket(server);
    startReminderJob();
    server.listen(PORT, () => console.log(`TaskFlow API running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
})();
