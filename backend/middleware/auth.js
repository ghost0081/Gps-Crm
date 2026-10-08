/**
 * JWT authentication middleware.
 *
 * Verifies the Bearer token from the Authorization header.
 * Attaches the decoded payload to req.user so controllers can read:
 *   req.user.id   — MongoDB _id of the authenticated entity
 *   req.user.role — 'Admin' | 'Student' | 'Teacher' | 'Staff' | 'Parent' | 'Guardian' | 'FrontDesk'
 *
 * Usage in routes:
 *   const { protect, allow } = require('../middleware/auth');
 *
 *   router.get('/resource', protect, handler);                  // any authenticated user
 *   router.get('/admin-only', protect, allow('Admin'), handler); // role-restricted
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'gps_crm_default_secret_key_change_in_production';

/**
 * Verifies the JWT and populates req.user.
 * Returns 401 if the token is missing or invalid.
 */
const protect = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.slice(7); // strip "Bearer "

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, role, iat, exp }
        next();
    } catch (err) {
        // Pass to centralized error handler (handles JsonWebTokenError / TokenExpiredError)
        next(err);
    }
};

/**
 * Role-based access control guard. Must be used AFTER protect.
 *
 * @param {...string} roles — allowed roles, e.g. allow('Admin', 'Teacher')
 */
const allow = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
    }
    next();
};

module.exports = { protect, allow };
