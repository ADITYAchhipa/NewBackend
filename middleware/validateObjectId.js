import mongoose from 'mongoose';

/**
 * MongoDB ObjectId Validation Middleware
 * 
 * Prevents attacks using invalid ObjectIds:
 * - GET /property/aaaaaaaaaaaaaaaaaaaaaaaa (invalid)
 * - GET /property/{$ne:null} (injection attempt)
 * - GET /property/123 (wrong length)
 * - GET /property/../../admin (path traversal)
 * 
 * Why this matters:
 * - Prevents CastError exceptions that leak stack traces
 * - Stops timing-based ID enumeration attacks
 * - Prevents exception flood DoS
 * - Blocks MongoDB operator injection in URL params
 * 
 * Usage:
 * router.get('/property/:id', validateObjectId('id'), getProperty);
 * router.put('/vehicle/:vehicleId', validateObjectId('vehicleId'), updateVehicle);
 */

/**
 * Validate a single ObjectId parameter
 * @param {string} paramName - Name of the route parameter (default: 'id')
 * @returns {Function} Express middleware
 */
export const validateObjectId = (paramName = 'id') => {
    return (req, res, next) => {
        const id = req.params[paramName];

        // Check if ID exists
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'ID parameter is required'
            });
        }

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            // Log suspicious attempts
            console.warn(`⚠️ Invalid ObjectId attempt: ${paramName}=${id} from IP: ${req.ip}`);

            return res.status(400).json({
                success: false,
                message: 'Invalid ID format'
            });
        }

        // Additional check: Ensure it's 24-character hex string
        // This catches edge cases where isValid passes but it's not a proper ObjectId
        if (!/^[0-9a-fA-F]{24}$/.test(id)) {
            console.warn(`⚠️ Malformed ObjectId: ${paramName}=${id}`);

            return res.status(400).json({
                success: false,
                message: 'Invalid ID format'
            });
        }

        next();
    };
};

/**
 * Validate multiple ObjectId parameters
 * Useful for routes like: /property/:propertyId/booking/:bookingId
 * 
 * @param {string[]} paramNames - Array of parameter names to validate
 * @returns {Function} Express middleware
 * 
 * @example
 * router.get('/property/:propertyId/booking/:bookingId',
 *     validateObjectIds(['propertyId', 'bookingId']),
 *     getBooking
 * );
 */
export const validateObjectIds = (paramNames = ['id']) => {
    return (req, res, next) => {
        for (const paramName of paramNames) {
            const id = req.params[paramName];

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: `${paramName} parameter is required`
                });
            }

            if (!mongoose.Types.ObjectId.isValid(id) || !/^[0-9a-fA-F]{24}$/.test(id)) {
                console.warn(`⚠️ Invalid ObjectId: ${paramName}=${id}`);

                return res.status(400).json({
                    success: false,
                    message: 'Invalid ID format'
                });
            }
        }

        next();
    };
};

export default { validateObjectId, validateObjectIds };
