import { Router } from 'express';
import optionalAuth from '../middleware/optionalAuth.js';
import {
    getRecommendedProperties,
    getRecommendedVehicles,
    clearRecommendationCache
} from '../controller/recommendedController.js';
import { csrfProtect } from '../middleware/csrfProtection.js';
import { recommendationLimiter, recommendationBurstLimiter } from '../middleware/advancedRateLimiter.js';
import authUser from '../middleware/authUser.js';
const router = Router();

/**
 * GET /api/recommended/properties?category=all
 * Get personalized property recommendations
 * 
 * @query {string} category - Category filter ('all', 'Apartments', 'Houses', etc.)
 * @returns {array} Recommended properties (max 20 for 'all', max 10 for specific category)
 */
router.get('/properties', optionalAuth, recommendationBurstLimiter, recommendationLimiter, getRecommendedProperties);

/**
 * GET /api/recommended/vehicles?category=all
 * Get personalized vehicle recommendations
 * 
 * @query {string} category - Category filter ('all', 'Sedans', 'SUVs', etc.)
 * @returns {array} Recommended vehicles (max 20 for 'all', max 10 for specific category)
 */
router.get('/vehicles', optionalAuth, recommendationBurstLimiter, recommendationLimiter, getRecommendedVehicles);

/**
 * DELETE /api/recommended/cache
 * Clear recommendation cache for current user
 * 
 * @returns {object} Success message with count of cleared entries
 */
router.delete('/cache', authUser, clearRecommendationCache);

export default router;
