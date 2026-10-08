/**
 * Rate limiter configurations.
 *
 * Uses express-rate-limit.
 *
 * Different limits for different endpoint sensitivity:
 *   loginLimiter      — login / auth endpoints  (10 req / 15 min per IP)
 *   bleTelemetryLimiter — high-frequency device endpoint (300 req / min per IP)
 *   generalLimiter    — all other API endpoints  (200 req / 15 min per IP)
 */

const rateLimit = require('express-rate-limit');

/**
 * Strict limiter for all login/auth endpoints.
 * Prevents brute-force credential attacks.
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
    skipSuccessfulRequests: false,
});

/**
 * Relaxed limiter for the BLE telemetry endpoint.
 * Devices push location frequently; a tight limit would drop data.
 */
const bleTelemetryLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many telemetry requests.' },
});

/**
 * General limiter applied to all remaining API routes.
 * Guards against accidental hammering and scraping.
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please slow down.' },
});

module.exports = { loginLimiter, bleTelemetryLimiter, generalLimiter };
