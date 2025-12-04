import express from 'express';
import {
    addToVisited,
    getVisitedProperties,
    clearVisitedProperties
} from '../controller/visitedPropertiesController.js';
import authUser from '../middleware/authUser.js';

const router = express.Router();

/**
 * All routes require authentication
 */

/**
 * POST /api/user/visited/:propertyId
 * Add property to visited list
 * 
 * @param {string} propertyId - Property ID to add
 * @returns {object} Success message and visited count
 */
router.post('/:propertyId', authUser, addToVisited);

/**
 * GET /api/user/visited
 * Get user's visited properties
 * 
 * @query {number} limit - Optional limit (default: 20)
 * @returns {array} Visited properties with full details
 */
router.get('/', authUser, getVisitedProperties);

/**
 * DELETE /api/user/visited
 * Clear user's visited properties history
 * 
 * @returns {object} Success message
 */
router.delete('/', authUser, clearVisitedProperties);

export default router;
