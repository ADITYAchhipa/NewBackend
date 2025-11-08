import express from 'express';
import {
  addPropertyToFavourites,
  addVehicleToFavourites,
  removePropertyFromFavourites,
  removeVehicleFromFavourites,
  getUserFavourites,
  getUserFavouriteProperties,
  getUserFavouriteVehicles
} from '../controller/favouriteController.js';

const router = express.Router();

// Note: Add auth middleware to protect these routes
// e.g., import authMiddleware from '../middleware/auth.js';
// router.use(authMiddleware);

/**
 * GET /api/favourite
 * Get all user's favourites (both properties and vehicles)
 * 
 * Query Parameters:
 * - userId (required if not using auth middleware): User's ID
 * 
 * Example: /api/favourite?userId=507f1f77bcf86cd799439011
 */
router.get('/', getUserFavourites);

/**
 * GET /api/favourite/properties
 * Get user's favourite properties only
 * 
 * Query Parameters:
 * - userId (required if not using auth middleware): User's ID
 * 
 * Example: /api/favourite/properties?userId=507f1f77bcf86cd799439011
 */
router.get('/properties', getUserFavouriteProperties);

/**
 * GET /api/favourite/vehicles
 * Get user's favourite vehicles only
 * 
 * Query Parameters:
 * - userId (required if not using auth middleware): User's ID
 * 
 * Example: /api/favourite/vehicles?userId=507f1f77bcf86cd799439011
 */
router.get('/vehicles', getUserFavouriteVehicles);

/**
 * POST /api/favourite/property/:id
 * Add a property to user's favourites
 * 
 * URL Parameters:
 * - id (required): Property ID
 * 
 * Body (if not using auth middleware):
 * - userId (required): User's ID
 * 
 * Example: POST /api/favourite/property/507f1f77bcf86cd799439011
 */
router.post('/property/:id', addPropertyToFavourites);

/**
 * POST /api/favourite/vehicle/:id
 * Add a vehicle to user's favourites
 * 
 * URL Parameters:
 * - id (required): Vehicle ID
 * 
 * Body (if not using auth middleware):
 * - userId (required): User's ID
 * 
 * Example: POST /api/favourite/vehicle/507f1f77bcf86cd799439011
 */
router.post('/vehicle/:id', addVehicleToFavourites);

/**
 * DELETE /api/favourite/property/:id
 * Remove a property from user's favourites
 * 
 * URL Parameters:
 * - id (required): Property ID
 * 
 * Body (if not using auth middleware):
 * - userId (required): User's ID
 * 
 * Example: DELETE /api/favourite/property/507f1f77bcf86cd799439011
 */
router.delete('/property/:id', removePropertyFromFavourites);

/**
 * DELETE /api/favourite/vehicle/:id
 * Remove a vehicle from user's favourites
 * 
 * URL Parameters:
 * - id (required): Vehicle ID
 * 
 * Body (if not using auth middleware):
 * - userId (required): User's ID
 * 
 * Example: DELETE /api/favourite/vehicle/507f1f77bcf86cd799439011
 */
router.delete('/vehicle/:id', removeVehicleFromFavourites);

export default router;
