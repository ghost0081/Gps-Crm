/**
 * Application entry point.
 *
 * Production-grade enhancements:
 *  1. dotenv loaded FIRST before any process.env access
 *  2. helmet for security headers (configured for static SPA compatibility)
 *  3. CORS restricted to explicit allowed origins
 *  4. requestId middleware for log tracing and request correlation
 *  5. generalLimiter applied globally
 *  6. Centralized errorHandler registered last
 *  7. Mongoose options cleaned up (useNewUrlParser/useUnifiedTopology removed in Mongoose 7+)
 *  8. Graceful shutdown on SIGTERM / SIGINT
 *  9. Health check endpoint at /health
 */

const dotenv = require('dotenv');
dotenv.config(); // must be first

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const path = require('path');

const Routes = require('./routes/route.js');
const startTrackerServer = require('./tracker-server.js');
const errorHandler = require('./middleware/errorHandler.js');
const requestId = require('./middleware/requestId.js');
const { generalLimiter } = require('./middleware/rateLimiter.js');

const PORT = process.env.PORT || 5000;
const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
    console.error('FATAL: MONGO_URL environment variable is not set.');
    process.exit(1);
}

if (!process.env.JWT_SECRET) {
    console.warn('WARN: JWT_SECRET environment variable is not set. Default fallback will be used in development.');
}

const app = express();

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false, // Prevents blocking bundled React frontend assets
    crossOriginEmbedderPolicy: false,
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5000'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));

// ── Request tracing ───────────────────────────────────────────────────────────
app.use(requestId);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));

// ── Global rate limit ─────────────────────────────────────────────────────────
app.use(generalLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/', Routes);

// ── Static frontend ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'build')));

// Wildcard route to handle React Router client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// ── Centralized error handler (must be last) ──────────────────────────────────
app.use(errorHandler);

// ── Database & Server Bootstrap ───────────────────────────────────────────────
const server = app.listen(PORT, () => {
    console.log(`Server started at port no. ${PORT}`);
    // Start GT06 Tracker TCP Server
    startTrackerServer();
});

mongoose
    .connect(MONGO_URL)
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((err) => {
        console.error('NOT CONNECTED TO NETWORK:', err.message);
        console.warn('⚠️  MongoDB connection failed. Please ensure your MongoDB instance is running at', MONGO_URL);
    });

// ── Graceful shutdown ─────────────────────────────────────────────────
const shutdown = (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
        console.log('HTTP server closed.');
        mongoose.connection.close(false).then(() => {
            console.log('MongoDB connection closed.');
            process.exit(0);
        }).catch(() => process.exit(0));
    });

    // Force-exit if shutdown takes too long
    setTimeout(() => {
        console.error('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));