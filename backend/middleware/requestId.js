/**
 * Request ID middleware.
 *
 * Attaches a unique ID to every inbound request so that:
 *   - Logs can be correlated across the request lifecycle
 *   - The ID is echoed back in the X-Request-Id response header
 *     so clients/support can reference it when reporting issues
 *
 * The ID is available on req.requestId throughout the request.
 *
 * Uses crypto.randomUUID() (Node 14.17+, no external dependency).
 */

const { randomUUID } = require('crypto');

const requestId = (req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
};

module.exports = requestId;
