import Property from '../models/property.js';
import Vehicle from '../models/vehicle.js';
import logger from '../utils/logger.js';

/**
 * Middleware to verify resource ownership
 * Prevents IDOR attacks by ensuring user owns the resource they're trying to modify
 * 
 * Usage:
 * router.put('/property/:id', authUser, authorizeOwner(Property, 'ownerId'), updateProperty);
 * router.delete('/vehicle/:id', authUser, authorizeOwner(Vehicle, 'ownerId'), deleteVehicle);
 */
export const authorizeOwner = (Model, ownerField = 'ownerId') => {
    return async (req, res, next) => {
        try {
            const resourceId = req.params.id;
            const userId = req.userId; // From authUser middleware

            if (!resourceId) {
                return res.status(400).json({
                    success: false,
                    message: 'Resource ID is required'
                });
            }

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Not authenticated'
                });
            }

            // Fetch resource and check ownership
            const resource = await Model.findById(resourceId).select(ownerField);

            if (!resource) {
                return res.status(404).json({
                    success: false,
                    message: 'Resource not found'
                });
            }

            // Check ownership
            const ownerId = resource[ownerField]?.toString() || resource[ownerField];
            if (ownerId !== userId.toString()) {
                logger.warn(`IDOR attempt: User ${userId} tried to access resource ${resourceId} owned by ${ownerId}`);
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: You do not have permission to access this resource'
                });
            }

            // Attach resource to request for use in controller (optional optimization)
            req.resource = resource;
            next();

        } catch (error) {
            console.error('Authorization error:', error);
            return res.status(500).json({
                success: false,
                message: 'Authorization check failed'
            });
        }
    };
};

/**
 * Alternative: Inline ownership check for atomic operations
 * Use this pattern directly in controllers for atomic updates
 * 
 * Example:
 * const property = await Property.findOneAndUpdate(
 *     { _id: req.params.id, ownerId: req.userId },
 *     updateData,
 *     { new: true }
 * );
 * 
 * if (!property) {
 *     return res.status(404).json({ message: "Not found or access denied" });
 * }
 */

export default { authorizeOwner };
