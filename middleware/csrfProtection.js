/**
 * CSRF Protection Middleware
 * Implements double-submit cookie pattern for CSRF protection
 * Required when using SameSite=None cookies
 */

import crypto from 'crypto';

/**
 * Generate CSRF token on login/auth
 * Call this after successful login
 */
export function generateCsrfToken(res) {
    const token = crypto.randomBytes(32).toString('hex');

    // Set CSRF token as readable cookie (non-HttpOnly)
    // Frontend needs to read this to send in header
    res.cookie('csrfToken', token, {
        httpOnly: false,  // Frontend must be able to read this
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // Same as auth token
    });

    return token;
}

/**
 * CSRF Protection Middleware
 * Validates CSRF token for state-changing operations
 * 
 * How it works:
 * 1. Cookie contains csrfToken (set on login)
 * 2. Frontend reads cookie and sends in X-CSRF-Token header
 * 3. Middleware compares both values
 * 4. If they don't match = CSRF attack blocked
 */
export const csrfProtect = (req, res, next) => {
    const csrfCookie = req.cookies.csrfToken;
    const csrfHeader = req.headers['x-csrf-token'] || req.headers['X-CSRF-Token'];

    // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    // Check if both exist and match
    if (!csrfCookie || !csrfHeader) {
        console.log('🚨 CSRF: Missing token -', {
            cookie: !!csrfCookie,
            header: !!csrfHeader,
            method: req.method,
            path: req.path
        });
        return res.status(403).json({
            success: false,
            message: 'CSRF token missing. Please refresh and try again.'
        });
    }

    if (csrfCookie !== csrfHeader) {
        console.log('🚨 CSRF: Token mismatch -', {
            method: req.method,
            path: req.path,
            ip: req.ip
        });
        return res.status(403).json({
            success: false,
            message: 'CSRF validation failed. Please refresh and try again.'
        });
    }

    // CSRF token valid
    next();
};

/**
 * Apply CSRF protection to specific routes
 * Use this for state-changing operations only
 */
export default {
    csrfProtect,
    generateCsrfToken
};
