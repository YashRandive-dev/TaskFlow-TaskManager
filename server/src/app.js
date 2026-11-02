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

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
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

app.use(notFound);
app.use(errorHandler);

module.exports = app;
