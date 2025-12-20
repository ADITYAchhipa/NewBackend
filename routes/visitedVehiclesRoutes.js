import express from 'express';
import {
    addToVisited,
    getVisitedVehicles,
    clearVisitedVehicles
} from '../controller/visitedVehiclesController.js';
import authUser from '../middleware/authUser.js';
import { validateObjectId } from '../middleware/validateObjectId.js';

const router = express.Router();

/**
 * All routes require authentication
 */

/**
 * POST /api/user/visited-vehicles/:vehicleId
 * Add vehicle to visited list
 * 
 * @param {string} vehicleId - Vehicle ID to add
 * @returns {object} Success message and visited count
 */
router.post('/:vehicleId', authUser, validateObjectId('vehicleId'), addToVisited);

/**
 * GET /api/user/visited-vehicles
 * Get user's visited vehicles
 * 
 * @query {number} limit - Optional limit (default: 20)
 * @returns {array} Visited vehicles with full details
 */
router.get('/', authUser, getVisitedVehicles);

/**
 * DELETE /api/user/visited-vehicles
 * Clear user's visited vehicles history
 * 
 * @returns {object} Success message
 */
router.delete('/', authUser, clearVisitedVehicles);

export default router;
