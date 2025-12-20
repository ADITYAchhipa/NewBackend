import User from '../models/user.js';
import Property from '../models/property.js';
import { VISITED_PROPERTIES_FIELDS } from '../utils/projections.js';

/**
 * Add property to user's visited properties list
 * Implements LRU (Least Recently Used) pattern:
 * - Most recent visit at index 0
 * - Max 20 properties
 * - Revisiting moves property to front
 */
export const addToVisited = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const userId = req.userId; // From authUser middleware

        // Validate property exists
        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }

        const user = await User.findById(userId).select(VISITED_PROPERTIES_FIELDS);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Initialize visitedProperties if it doesn't exist
        if (!user.visitedProperties) {
            user.visitedProperties = [];
        }

        // LRU Logic:
        // 1. Remove property if already exists (to avoid duplicates)
        user.visitedProperties = user.visitedProperties.filter(
            visit => visit.propertyId.toString() !== propertyId
        );

        // 2. Add property to front (index 0) with current timestamp
        user.visitedProperties.unshift({
            propertyId: propertyId,
            visitedAt: new Date()
        });

        // 3. If array length > 20, keep only first 20 (remove oldest)
        if (user.visitedProperties.length > 20) {
            user.visitedProperties = user.visitedProperties.slice(0, 20);
        }

        await user.save();

        res.json({
            success: true,
            message: 'Property added to visited list',
            visitedCount: user.visitedProperties.length
        });

    } catch (error) {
        console.error('Error in addToVisited:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to add property to visited list'
        });
    }
};

/**
 * Get user's visited properties with full property details
 * Returns properties in order: most recent first
 */
export const getVisitedProperties = async (req, res) => {
    try {
        const userId = req.userId; // From authUser middleware
        const limit = parseInt(req.query.limit) || 20;

        const user = await User.findById(userId)
            .select('visitedProperties')
            .populate({
                path: 'visitedProperties.propertyId',
                select: '-__v',
                populate: {
                    path: 'ownerId',
                    select: 'name avatar phone'
                }
            });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Filter out any null/invalid property references and apply limit
        const visitedProperties = (user.visitedProperties || [])
            .filter(visit => visit.propertyId) // Remove null references
            .slice(0, limit)
            .map(visit => ({
                property: visit.propertyId,
                visitedAt: visit.visitedAt
            }));

        res.json({
            success: true,
            results: visitedProperties,
            total: visitedProperties.length,
            message: 'Visited properties fetched successfully'
        });

    } catch (error) {
        console.error('Error in getVisitedProperties:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch visited properties'
        });
    }
};

/**
 * Clear user's visited properties history
 */
export const clearVisitedProperties = async (req, res) => {
    try {
        const userId = req.userId;

        const user = await User.findById(userId).select('visitedProperties');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.visitedProperties = [];
        await user.save();

        res.json({
            success: true,
            message: 'Visited properties cleared successfully'
        });

    } catch (error) {
        console.error('Error in clearVisitedProperties:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to clear visited properties'
        });
    }
};
