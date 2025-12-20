/**
 * Security utilities for input validation and sanitization
 */

/**
 * Escape regex special characters to prevent ReDoS attacks
 * @param {string} string - Input string to escape
 * @param {number} maxLength - Maximum allowed length (default: 100)
 * @returns {string} - Escaped string safe for use in regex
 */
export function escapeRegex(string, maxLength = 100) {
    if (typeof string !== 'string') return '';

    // Limit length to prevent performance issues
    if (string.length > maxLength) {
        string = string.substring(0, maxLength);
    }

    // Escape special regex characters: . * + ? ^ $ { } ( ) | [ ] \
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitize search query
 * - Limits length
 * - Escapes regex characters
 * - Trims whitespace
 * @param {string} query - Search query
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Safe search query
 */
export function sanitizeSearchQuery(query, maxLength = 100) {
    if (typeof query !== 'string') return '';

    // Trim and limit length
    const trimmed = query.trim().substring(0, maxLength);

    // Escape for safe regex use
    return escapeRegex(trimmed, maxLength);
}

/**
 * Sanitize query parameters to prevent NoSQL injection
 * Converts objects to strings and removes MongoDB operator patterns
 * 
 * Prevents attacks like: ?status[$ne]=null
 * 
 * @param {any} value - Query parameter value
 * @returns {string|number|boolean|null} - Sanitized value
 * 
 * @example
 * sanitizeQueryParam({ $ne: null }) // Returns ''
 * sanitizeQueryParam('pending') // Returns 'pending'
 * sanitizeQueryParam('test$ne') // Returns 'testne'
 */
export function sanitizeQueryParam(value) {
    // If value is an object (including arrays), reject it
    if (value !== null && typeof value === 'object') {
        console.warn('⚠️ NoSQL injection attempt detected - object in query param');
        return '';
    }

    // Allow only primitives: string, number, boolean, null
    if (typeof value === 'string') {
        // Remove MongoDB operators from strings
        const sanitized = value.replace(/\$\w+/g, '');
        return sanitized.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    return null;
}

/**
 * Sanitize all query parameters in an object
 * @param {Object} queryObj - req.query object
 * @returns {Object} - Sanitized query object
 * 
 * @example
 * sanitizeQueryObject({ status: { $ne: null }, page: '1' })
 * // Returns: { status: '', page: '1' }
 */
export function sanitizeQueryObject(queryObj) {
    const sanitized = {};

    for (const [key, value] of Object.entries(queryObj)) {
        // Also sanitize the key to prevent key injection
        const cleanKey = key.replace(/\$\w+/g, '').replace(/[^\w]/g, '');
        if (cleanKey) {
            sanitized[cleanKey] = sanitizeQueryParam(value);
        }
    }

    return sanitized;
}

export default {
    escapeRegex,
    sanitizeSearchQuery,
    sanitizeQueryParam,
    sanitizeQueryObject
};
