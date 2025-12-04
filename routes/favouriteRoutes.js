import express from 'express';
import {
  addPropertyToFavourites,
  addVehicleToFavourites,
  removePropertyFromFavourites,
  removeVehicleFromFavourites,
  getUserFavourites,
  getUserFavouriteProperties,
  getUserFavouriteVehicles,
  togglePropertyFavourite,
  toggleVehicleFavourite,
  getUserFavouriteIds
} from '../controller/favouriteController.js';
import authUser from '../middleware/authUser.js';

const router = express.Router();

// All favourite routes require authentication
router.use(authUser);

/**
 * GET /api/favourite/ids
 * Get just the favourite IDs (lightweight for app startup)
 * Returns: { properties: string[], vehicles: string[], all: string[] }
 */
router.get('/ids', getUserFavouriteIds);

/**
 * GET /api/favourite
 * Get all user's favourites (both properties and vehicles)
 */
router.get('/', getUserFavourites);

/**
 * GET /api/favourite/properties
 * Get user's favourite properties only
 */
router.get('/properties', getUserFavouriteProperties);

/**
 * GET /api/favourite/vehicles
 * Get user's favourite vehicles only
 */
router.get('/vehicles', getUserFavouriteVehicles);

/**
 * POST /api/favourite/toggle/property/:id
 * Toggle property favourite status (add if not favourited, remove if favourited)
 * Returns: { isFavourite: boolean, propertyId: string }
 */
router.post('/toggle/property/:id', togglePropertyFavourite);

/**
 * POST /api/favourite/toggle/vehicle/:id
 * Toggle vehicle favourite status (add if not favourited, remove if favourited)
 * Returns: { isFavourite: boolean, vehicleId: string }
 */
router.post('/toggle/vehicle/:id', toggleVehicleFavourite);

/**
 * POST /api/favourite/property/:id
 * Add a property to user's favourites
 */
router.post('/property/:id', addPropertyToFavourites);

/**
 * POST /api/favourite/vehicle/:id
 * Add a vehicle to user's favourites
 */
router.post('/vehicle/:id', addVehicleToFavourites);

/**
 * DELETE /api/favourite/property/:id
 * Remove a property from user's favourites
 */
router.delete('/property/:id', removePropertyFromFavourites);

/**
 * DELETE /api/favourite/vehicle/:id
 * Remove a vehicle from user's favourites
 */
router.delete('/vehicle/:id', removeVehicleFromFavourites);

export default router;

