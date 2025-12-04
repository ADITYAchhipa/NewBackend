import Property from '../models/property.js';
import Vehicle from '../models/vehicle.js';
import mongoose from 'mongoose';

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
 * Get only featured properties with pagination and filtering
 * GET /api/featured/properties?page=1&limit=10&category=Apartments&excludeIds=id1,id2
 */
export const getFeaturedPropertiesOnly = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const category = req.query.category;
    const excludeIdsParam = req.query.excludeIds ? req.query.excludeIds.split(',') : [];

    // Build match criteria
    const matchCriteria = {
      Featured: true,
      status: 'active',
      available: true
    };

    // Add category filter if provided and not 'all'
    // Category comes in plural form from frontend (e.g., "Apartments")
    if (category && category.toLowerCase() !== 'all') {
      // Remove trailing 's' to match backend format if needed
      let categoryValue = category;
      if (category.endsWith('s') && category !== 'Others') {
        categoryValue = category.slice(0, -1);
      }
      // Convert to lowercase to match database schema (apartment, house, villa, etc.)
      matchCriteria.category = categoryValue.toLowerCase();
    }

    // Exclude already-seen properties - convert string IDs to ObjectIds
    if (excludeIdsParam.length > 0) {
      const excludeIds = excludeIdsParam
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      if (excludeIds.length > 0) {
        matchCriteria._id = { $nin: excludeIds };
      }
    }

    // Use aggregation with consistent sorting instead of $sample to prevent duplicates
    // Sort by _id for deterministic ordering while maintaining variety
    const pipeline = [
      { $match: matchCriteria },
      { $sort: { _id: 1 } }, // Deterministic sorting
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'ownerId',
          foreignField: '_id',
          as: 'owner'
        }
      },
      {
        $unwind: {
          path: '$owner',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          __v: 0,
          'owner.password': 0,
          'owner.__v': 0
        }
      }
    ];

    const properties = await Property.aggregate(pipeline);

    // Get total count for hasMore flag
    const totalCount = await Property.countDocuments(matchCriteria);
    const hasMore = properties.length === limit && (excludeIdsParam.length + limit) < totalCount;

    res.json({
      success: true,
      results: properties,
      page,
      limit,
      total: totalCount,
      hasMore,
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
 * Get only featured vehicles with pagination and filtering
 * GET /api/featured/vehicles?page=1&limit=10&search=cars&excludeIds=id1,id2
 */
export const getFeaturedVehiclesOnly = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search; // vehicleType filter
    const excludeIdsParam = req.query.excludeIds ? req.query.excludeIds.split(',') : [];

    // Build match criteria
    const matchCriteria = {
      Featured: true,
      status: 'active',
      available: true
    };

    // Add vehicleType filter if provided and not 'all'
    // Search/category comes in plural form from frontend (e.g., "cars")
    if (search && search.toLowerCase() !== 'all') {
      // Remove trailing 's' to match backend enum (car, bike, van, scooter)
      let vehicleType = search.toLowerCase();
      if (vehicleType.endsWith('s')) {
        vehicleType = vehicleType.slice(0, -1);
      }
      matchCriteria.vehicleType = vehicleType;
    }

    // Exclude already-seen vehicles - convert string IDs to ObjectIds
    if (excludeIdsParam.length > 0) {
      const excludeIds = excludeIdsParam
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      if (excludeIds.length > 0) {
        matchCriteria._id = { $nin: excludeIds };
      }
    }

    // Use aggregation with consistent sorting
    const pipeline = [
      { $match: matchCriteria },
      { $sort: { _id: 1 } }, // Deterministic sorting
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'ownerId',
          foreignField: '_id',
          as: 'owner'
        }
      },
      {
        $unwind: {
          path: '$owner',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          __v: 0,
          'owner.password': 0,
          'owner.__v': 0
        }
      }
    ];

    const vehicles = await Vehicle.aggregate(pipeline);

    // Get total count for hasMore flag
    const totalCount = await Vehicle.countDocuments(matchCriteria);
    const hasMore = vehicles.length === limit && (excludeIdsParam.length + limit) < totalCount;

    res.json({
      success: true,
      results: vehicles, // Changed from data.vehicles to results
      page,
      limit,
      total: totalCount,
      hasMore,
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
