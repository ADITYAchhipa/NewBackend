import express from 'express';
import {
  getNearbyListings,
  getNearbyProperties,
  getNearbyVehicles,
  getCurrentCoordinates
} from '../controller/nearbyController.js';

const router = express.Router();

// Note: Add auth middleware if you want to protect these routes
// e.g., import authMiddleware from '../middleware/auth.js';
// router.use(authMiddleware);

/**
 * GET /api/nearby
 * Get all nearby listings (both properties and vehicles)
 * 
 * Query Parameters:
 * - latitude (required): User's latitude
 * - longitude (required): User's longitude
 * - maxDistance (optional): Maximum search radius in km (default: 10)
 * - type (optional): Filter by type - 'properties', 'vehicles', or 'all' (default: 'all')
 * 
 * Example: /api/nearby?latitude=28.6139&longitude=77.2090&maxDistance=5&type=all
 */
router.get('/', getNearbyListings);

/**
 * GET /api/nearby/properties
 * Get only nearby properties
 * 
 * Query Parameters:
 * - latitude (required): User's latitude
 * - longitude (required): User's longitude
 * - maxDistance (optional): Maximum search radius in km (default: 10)
 * 
 * Example: /api/nearby/properties?latitude=28.6139&longitude=77.2090&maxDistance=5
 */
router.get('/properties', getNearbyProperties);

/**
 * GET /api/nearby/vehicles
 * Get only nearby vehicles
 * 
 * Query Parameters:
 * - latitude (required): User's latitude
 * - longitude (required): User's longitude
 * - maxDistance (optional): Maximum search radius in km (default: 10)
 * 
 * Example: /api/nearby/vehicles?latitude=28.6139&longitude=77.2090&maxDistance=5
 */
router.get('/vehicles', getNearbyVehicles);

/**
 * GET /api/nearby/coordinates
 * Get current coordinates of the user
 * 
 * Query Parameters (optional):
 * - latitude: User's latitude (if available from client)
 * - longitude: User's longitude (if available from client)
 * 
 * If coordinates are not provided, the API will attempt to determine
 * the user's location using IP geolocation
 * 
 * Example: /api/nearby/coordinates
 * Example: /api/nearby/coordinates?latitude=28.6139&longitude=77.2090
 */
router.get('/coordinates', getCurrentCoordinates);

export default router;
