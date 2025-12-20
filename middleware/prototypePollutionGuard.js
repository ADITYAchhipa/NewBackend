/**
 * Prototype Pollution Guard
 * Blocks dangerous keys that can bypass security checks
 * 
 * Protects against:
 * - Prototype pollution (__proto__, constructor, prototype)
 * - MongoDB operator injection ($gt, $ne, etc.)
 * - Deep object attacks
 */

const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Recursively check object for dangerous keys
 */
function checkObject(obj, path = 'root') {
    if (obj === null || typeof obj !== 'object') {
        return null; // Safe primitive
    }

    // Check arrays
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            const result = checkObject(obj[i], `${path}[${i}]`);
            if (result) return result;
        }
        return null;
    }

    // Check object keys
    for (const key in obj) {
        // Block dangerous keys (case-insensitive)
        if (DANGEROUS_KEYS.includes(key.toLowerCase())) {
            return {
                type: 'PROTOTYPE_POLLUTION',
                path: `${path}.${key}`,
                key
            };
        }

        // Block MongoDB operators in request body/query
        if (key.startsWith('$')) {
            return {
                type: 'OPERATOR_INJECTION',
                path: `${path}.${key}`,
                key
            };
        }

        // Recursively check nested objects
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            const result = checkObject(obj[key], `${path}.${key}`);
            if (result) return result;
        }
    }

    return null;
}

/**
 * Middleware to block prototype pollution attempts
 */
export const blockPrototypePollution = (req, res, next) => {
    try {
        // Check request body
        if (req.body && typeof req.body === 'object') {
            const bodyResult = checkObject(req.body, 'body');
            if (bodyResult) {
                console.warn(`🚨 SECURITY: ${bodyResult.type} blocked at ${bodyResult.path}`);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid request: forbidden key detected'
                });
            }
        }

        // Check query parameters
        if (req.query && typeof req.query === 'object') {
            const queryResult = checkObject(req.query, 'query');
            if (queryResult) {
                console.warn(`🚨 SECURITY: ${queryResult.type} blocked at ${queryResult.path}`);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid request: forbidden query parameter'
                });
            }
        }

        // Check params (can also be manipulated)
        if (req.params && typeof req.params === 'object') {
            const paramsResult = checkObject(req.params, 'params');
            if (paramsResult) {
                console.warn(`🚨 SECURITY: ${paramsResult.type} blocked at ${paramsResult.path}`);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid request: forbidden parameter'
                });
            }
        }

        next();
    } catch (error) {
        console.error('Error in prototype pollution guard:', error);
        // Fail open to avoid breaking the app
        next();
    }
};

export default blockPrototypePollution;
