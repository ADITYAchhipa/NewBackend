import User from '../models/user.js';
import Vehicle from '../models/vehicle.js';

/**
 * Add vehicle to user's visited vehicles list
 * Implements LRU (Least Recently Used) pattern:
 * - Most recent visit at index 0
 * - Max 20 vehicles
 * - Revisiting moves vehicle to front
 */
export const addToVisited = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const userId = req.userId; // From authUser middleware

        // Validate vehicle exists
        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Initialize visitedVehicles if it doesn't exist
        if (!user.visitedVehicles) {
            user.visitedVehicles = [];
        }

        // LRU Logic:
        // 1. Remove vehicle if already exists (to avoid duplicates)
        user.visitedVehicles = user.visitedVehicles.filter(
            visit => visit.vehicleId.toString() !== vehicleId
        );

        // 2. Add vehicle to front (index 0) with current timestamp
        user.visitedVehicles.unshift({
            vehicleId: vehicleId,
            visitedAt: new Date()
        });

        // 3. If array length > 20, keep only first 20 (remove oldest)
        if (user.visitedVehicles.length > 20) {
            user.visitedVehicles = user.visitedVehicles.slice(0, 20);
        }

        await user.save();

        res.json({
            success: true,
            message: 'Vehicle added to visited list',
            visitedCount: user.visitedVehicles.length
        });

    } catch (error) {
        console.error('Error in addToVisited:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to add vehicle to visited list'
        });
    }
};

/**
 * Get user's visited vehicles with full vehicle details
 * Returns vehicles in order: most recent first
 */
export const getVisitedVehicles = async (req, res) => {
    try {
        const userId = req.userId; // From authUser middleware
        const limit = parseInt(req.query.limit) || 20;

        const user = await User.findById(userId)
            .populate({
                path: 'visitedVehicles.vehicleId',
                select: '-__v',
                populate: {
                    path: 'ownerId',
                    select: 'name avatar phone'
                }
            })
            .select('visitedVehicles');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Filter out any null/invalid vehicle references and apply limit
        const visitedVehicles = (user.visitedVehicles || [])
            .filter(visit => visit.vehicleId) // Remove null references
            .slice(0, limit)
            .map(visit => ({
                vehicle: visit.vehicleId,
                visitedAt: visit.visitedAt
            }));

        res.json({
            success: true,
            results: visitedVehicles,
            total: visitedVehicles.length,
            message: 'Visited vehicles fetched successfully'
        });

    } catch (error) {
        console.error('Error in getVisitedVehicles:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch visited vehicles'
        });
    }
};

/**
 * Clear user's visited vehicles history
 */
export const clearVisitedVehicles = async (req, res) => {
    try {
        const userId = req.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.visitedVehicles = [];
        await user.save();

        res.json({
            success: true,
            message: 'Visited vehicles cleared successfully'
        });

    } catch (error) {
        console.error('Error in clearVisitedVehicles:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to clear visited vehicles'
        });
    }
};
