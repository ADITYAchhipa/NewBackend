import express from 'express';
import {
  getFeaturedListings,
  getFeaturedPropertiesOnly,
  getFeaturedVehiclesOnly
} from '../controller/featuredController.js';

const router = express.Router();

/**
 * GET /api/featured
 * Get all featured listings (both properties and vehicles)
 * 
 * Query Parameters:
 * - limit (optional): Number of items to return per type (default: 10)
 * - type (optional): Filter by type - 'properties', 'vehicles', or 'all' (default: 'all')
 * 
 * Example: /api/featured?limit=10&type=all
 */
router.get('/', getFeaturedListings);

/**
 * GET /api/featured/properties
 * Get only featured properties
 * 
 * Query Parameters:
 * - limit (optional): Number of properties to return (default: 10)
 * 
 * Example: /api/featured/properties?limit=10
 */
router.get('/properties', getFeaturedPropertiesOnly);

/**
 * GET /api/featured/vehicles
 * Get only featured vehicles
 * 
 * Query Parameters:
 * - limit (optional): Number of vehicles to return (default: 10)
 * 
 * Example: /api/featured/vehicles?limit=10
 */
router.get('/vehicles', getFeaturedVehiclesOnly);

export default router;
