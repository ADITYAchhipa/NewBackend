// utils/cacheHeaders.js
/**
 * Utility functions for setting HTTP cache headers
 * Implements Cache-Control with public/private differentiation
 */

/**
 * Set cache headers for public data (listings, featured items, search)
 * @param {Object} res - Express response object
 * @param {number} maxAge - Cache duration in seconds (default: 5 minutes)
 */
export const setCachePublic = (res, maxAge = 300) => {
    res.set({
        'Cache-Control': `public, max-age=${maxAge}`,
        'Vary': 'Authorization', // Important: different caches for authenticated/anonymous users
    });
};

/**
 * Set cache headers for private user-specific data (wishlist, bookings, user dashboard)
 * @param {Object} res - Express response object
 * @param {number} maxAge - Cache duration in seconds (default: 5 minutes)
 */
export const setCachePrivate = (res, maxAge = 300) => {
    res.set({
        'Cache-Control': `private, max-age=${maxAge}`,
        'Vary': 'Authorization',
    });
};

/**
 * Disable caching entirely (for mutations, real-time data)
 * @param {Object} res - Express response object
 */
export const setCacheNone = (res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
    });
};

/**
 * Set ETag header for conditional requests
 * Generates ETag from response data hash
 * @param {Object} res - Express response object
 * @param {*} data - Response data to hash
 */
export const setETag = (res, data) => {
    const crypto = require('crypto');
    const hash = crypto
        .createHash('md5')
        .update(JSON.stringify(data))
        .digest('hex');
    res.set('ETag', `"${hash}"`);
};

/**
 * Check if request has matching ETag (for 304 Not Modified)
 * @param {Object} req - Express request object
 * @param {string} etag - Current ETag value
 * @returns {boolean} - True if ETag matches (use 304)
 */
export const hasMatchingETag = (req, etag) => {
    const ifNoneMatch = req.headers['if-none-match'];
    return ifNoneMatch === etag;
};

/**
 * Middleware: Add ETag support for GET requests
 * Usage: app.use(etagMiddleware);
 */
export const etagMiddleware = (req, res, next) => {
    // Only for GET requests
    if (req.method !== 'GET') {
        return next();
    }

    // Store original res.json
    const originalJson = res.json.bind(res);

    // Override res.json
    res.json = function (data) {
        // Generate ETag only for successful responses
        if (res.statusCode === 200 && data) {
            const etag = setETag(res, data);

            // Check if client has matching ETag
            if (hasMatchingETag(req, res.get('ETag'))) {
                return res.status(304).end();
            }
        }

        // Send response normally
        return originalJson(data);
    };

    next();
};

export default {
    setCachePublic,
    setCachePrivate,
    setCacheNone,
    setETag,
    hasMatchingETag,
    etagMiddleware,
};
