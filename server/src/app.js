const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware');
const { uploadDir } = require('./utils/upload');

const app = express();

// Render (and most hosts) sit behind a reverse proxy: trust it so req.ip, rate limits and secure cookies work.
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // index.html sets the theme before first paint
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
    },
  },
}));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: true, legacyHeaders: false }));

app.use('/uploads', express.static(uploadDir));
app.get('/api/health', (req, res) => res.json({ success: true, data: { uptime: process.uptime() }, message: 'TaskFlow API ' }));
app.use('/api', routes);

// In production the built React app is served by this same server (one origin: no CORS or cookie issues).
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist, { index: false, maxAge: '1y', setHeaders: (res, file) => { if (file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
  app.get(/^\/(?!api\/|uploads\/|socket\.io\/).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
