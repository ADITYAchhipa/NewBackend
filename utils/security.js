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

export default {
    escapeRegex,
    sanitizeSearchQuery
};
