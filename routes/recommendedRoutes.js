import express from 'express';
import {
    getRecommendedProperties,
    getRecommendedVehicles,
    clearRecommendationCache
} from '../controller/recommendedController.js';
import authUser from '../middleware/authUser.js';

const router = express.Router();

/**
 * GET /api/recommended/properties?category=all
 * Get personalized property recommendations
 * 
 * @query {string} category - Category filter ('all', 'Apartments', 'Houses', etc.)
 * @returns {array} Recommended properties (max 20 for 'all', max 10 for specific category)
 */
router.get('/properties', authUser, getRecommendedProperties);

/**
 * GET /api/recommended/vehicles?category=all
 * Get personalized vehicle recommendations
 * 
 * @query {string} category - Category filter ('all', 'Sedans', 'SUVs', etc.)
 * @returns {array} Recommended vehicles (max 20 for 'all', max 10 for specific category)
 */
router.get('/vehicles', authUser, getRecommendedVehicles);

/**
 * DELETE /api/recommended/cache
 * Clear recommendation cache for current user
 * 
 * @returns {object} Success message with count of cleared entries
 */
router.delete('/cache', authUser, clearRecommendationCache);

export default router;
