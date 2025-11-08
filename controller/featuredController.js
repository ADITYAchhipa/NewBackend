import Property from '../models/property.js';
import Vehicle from '../models/vehicle.js';

/**
 * Get featured properties
 */
const getFeaturedProperties = async (limit = 10) => {
  try {
    const properties = await Property.find({
      Featured: true,
      status: 'active',
      available: true
    })
    .limit(limit)
    .select('-__v')
    .populate('ownerId', 'name avatar phone')
    .sort({ createdAt: -1 }) // Most recent first
    .lean();

    return properties;
  } catch (error) {
    console.error('Error finding featured properties:', error);
    throw error;
  }
};

/**
 * Get featured vehicles
 */
const getFeaturedVehicles = async (limit = 10) => {
  try {
    const vehicles = await Vehicle.find({
      Featured: true,
      status: 'active',
      available: true
    })
    .limit(limit)
    .select('-__v')
    .populate('ownerId', 'name avatar phone')
    .sort({ createdAt: -1 }) // Most recent first
    .lean();

    return vehicles;
  } catch (error) {
    console.error('Error finding featured vehicles:', error);
    throw error;
  }
};

/**
 * Get all featured listings (both properties and vehicles)
 * GET /api/featured
 */
export const getFeaturedListings = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const type = req.query.type || 'all'; // 'properties', 'vehicles', or 'all'

    // Fetch properties and vehicles in parallel based on type filter
    const [properties, vehicles] = await Promise.all([
      type === 'vehicles' ? [] : getFeaturedProperties(limit),
      type === 'properties' ? [] : getFeaturedVehicles(limit)
    ]);

    res.json({
      success: true,
      data: {
        properties,
        vehicles,
        total: {
          properties: properties.length,
          vehicles: vehicles.length,
          all: properties.length + vehicles.length
        }
      },
      message: 'Featured listings fetched successfully'
    });

  } catch (error) {
    console.error('Error in getFeaturedListings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch featured listings'
    });
  }
};

/**
 * Get only featured properties
 * GET /api/featured/properties
 */
export const getFeaturedPropertiesOnly = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const properties = await getFeaturedProperties(limit);

    res.json({
      success: true,
      data: {
        properties,
        total: properties.length
      },
      message: 'Featured properties fetched successfully'
    });

  } catch (error) {
    console.error('Error in getFeaturedPropertiesOnly:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch featured properties'
    });
  }
};

/**
 * Get only featured vehicles
 * GET /api/featured/vehicles
 */
export const getFeaturedVehiclesOnly = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const vehicles = await getFeaturedVehicles(limit);

    res.json({
      success: true,
      data: {
        vehicles,
        total: vehicles.length
      },
      message: 'Featured vehicles fetched successfully'
    });

  } catch (error) {
    console.error('Error in getFeaturedVehiclesOnly:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch featured vehicles'
    });
  }
};
