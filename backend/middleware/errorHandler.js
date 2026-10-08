/**
 * Centralized error handler middleware.
 *
 * Must be registered LAST in the Express middleware chain (after all routes).
 * Logs the full error internally and returns a sanitized response to the client
 * so internal details (stack traces, DB errors, paths) are never exposed.
 */

const errorHandler = (err, req, res, next) => {
    // Log full error server-side for debugging
    console.error({
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        error: err.message,
        stack: err.stack,
    });

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({ message: 'Validation failed', errors: messages });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        return res.status(409).json({ message: `Duplicate value for ${field}` });
    }

    // Mongoose CastError (bad ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).json({ message: 'Invalid ID format' });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
    }

    // Multer file errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large' });
    }

    // Default — never leak internals
    const status = err.status || err.statusCode || 500;
    const message = status < 500 ? err.message : 'Internal server error';
    return res.status(status).json({ message });
};

module.exports = errorHandler;
