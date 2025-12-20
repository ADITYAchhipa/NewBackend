/**
 * HTTP Parameter Pollution (HPP) Guard
 * 
 * Prevents attacks where duplicate query parameters are sent:
 * Example: ?city=Delhi&city=Mumbai
 * 
 * Express may parse this as an array, causing unexpected behavior.
 * This middleware normalizes all array values to their LAST element.
 * 
 * Why LAST value?
 * - Most predictable behavior
 * - Prevents attackers from hiding malicious values in first position
 * - Industry standard practice
 * 
 * Attack Prevention:
 * - ?id=valid&id=malicious → Uses 'malicious' (logged & caught by validation)
 * - ?role=user&role=admin → Uses 'admin' (caught by auth checks)
 * - ?price=100&price=1 → Uses '1' (caught by business logic)
 */

export const hppGuard = (req, res, next) => {
    // Normalize query parameters
    for (const key in req.query) {
        if (Array.isArray(req.query[key])) {
            // Log suspicious activity
            console.warn(`⚠️ HPP attempt detected: ${key}=${req.query[key].join(',')}`);

            // Take LAST value intentionally
            // This makes behavior predictable and easier to validate
            req.query[key] = req.query[key][req.query[key].length - 1];
        }
    }

    // Also normalize body parameters (for POST/PUT requests)
    if (req.body && typeof req.body === 'object') {
        for (const key in req.body) {
            if (Array.isArray(req.body[key]) && key !== 'amenities' && key !== 'rules' && key !== 'images') {
                // Skip legitimate array fields (amenities, rules, images, etc.)
                // Only normalize unexpected arrays
                console.warn(`⚠️ HPP attempt in body: ${key}=${req.body[key].join(',')}`);
                req.body[key] = req.body[key][req.body[key].length - 1];
            }
        }
    }

    next();
};

export default hppGuard;
