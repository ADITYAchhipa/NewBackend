// controller/vehicleController.js
import mongoose from 'mongoose';
import Vehicle from '../models/vehicle.js';
import { getSimilarVehicles as findSimilarVehicles } from '../utils/recommendationAlgorithm.js';
import { setCachePublic } from '../utils/cacheHeaders.js';

export const searchItems = async (req, res) => {
  try {
    console.log('🚗 Fetching featured vehicles...');
    let { search, page = 1, limit = 10, excludeIds = '' } = req.query;

    // Parse excludeIds (comma-separated string to array) and convert to ObjectIds
    const excludeIdsArray = excludeIds
      ? excludeIds.split(',').filter(id => id && mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id))
      : [];

    // Build query filter
    const filter = {
      Featured: true,
      available: true,  // Only available vehicles
      status: 'active',  // Only active vehicles
      _id: { $nin: excludeIdsArray }  // Exclude already-fetched IDs
    };

    // Add category filter if provided (search acts as category for vehicles)
    if (search) {
      search = search.slice(0, -1).toLowerCase();
      filter.vehicleType = search;  // or use another field like category if it exists
    }

    console.log('Query filter:', filter);

    // Count total matching documents
    const total = await Vehicle.countDocuments(filter);

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Fetch vehicles with random ordering
    // Using MongoDB aggregation for better randomization
    // Only return card-essential fields for optimized list loading
    const results = await Vehicle.aggregate([
      { $match: filter },
      { $sample: { size: Math.min(total - excludeIdsArray.length, limitNum) } },
      {
        $project: {
          _id: 1,
          make: 1,
          model: 1,
          year: 1,
          photos: { $slice: ['$photos', 1] }, // Only first photo for card
          'price.perDay': 1,
          'price.perHour': 1,
          'rating.avg': 1,
          'rating.count': 1,
          'location.city': 1,
          'location.state': 1,
          'location.address': 1,
          vehicleType: 1,
          seats: 1,
          transmission: 1,
          fuelType: 1,
          Featured: 1,
          available: 1
        }
      }
    ]);

    console.log(`✅ Found ${results.length} featured vehicles (page ${pageNum}, excluded: ${excludeIdsArray.length})`);

    // Set public cache headers (5 minutes)
    setCachePublic(res, 300);

    res.status(200).json({
      success: true,
      count: results.length,
      total,
      page: pageNum,
      limit: limitNum,
      hasMore: (skip + results.length) < total,
      results
    });

  } catch (error) {
    console.error('❌ Error fetching featured vehicles:', error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get vehicle by ID
export const getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.json({ success: false, message: 'Vehicle ID is required' });
    }

    const vehicle = await Vehicle.findById(id)
      .populate('ownerId', 'name email phone avatar');

    if (!vehicle) {
      return res.json({ success: false, message: 'Vehicle not found' });
    }

    // Set public cache headers (2 minutes)
    setCachePublic(res, 120);

    return res.json({
      success: true,
      vehicle
    });

  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.json({ success: false, message: error.message });
  }
};

// Get similar vehicles based on smart recommendation algorithm
export const getSimilarVehicles = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 6 } = req.query;

    console.log(`🔍 Finding similar vehicles for: ${id}`);

    if (!id) {
      return res.json({ success: false, message: 'Vehicle ID is required' });
    }

    // Get the base vehicle
    const baseVehicle = await Vehicle.findById(id);
    if (!baseVehicle) {
      return res.json({ success: false, message: 'Vehicle not found' });
    }

    console.log(`Base vehicle: ${baseVehicle.make} ${baseVehicle.model}, type: ${baseVehicle.vehicleType}`);

    // Get all available vehicles
    const filter = {
      available: true,
      status: 'active',
    };

    const allVehicles = await Vehicle.find(filter)
      .select('_id make model year photos price rating location vehicleType seats transmission fuelType ownerId')
      .limit(150) // Increase limit for better matches
      .lean();

    console.log(`Found ${allVehicles.length} potential matches`);

    // Use recommendation algorithm to find similar vehicles
    const similarWithScores = findSimilarVehicles(baseVehicle.toObject(), allVehicles, parseInt(limit));

    // Extract just the vehicles (without scores for client)
    const similar = similarWithScores.map(item => item.vehicle);

    console.log(`✅ Returning ${similar.length} similar vehicles`);

    return res.json({
      success: true,
      count: similar.length,
      results: similar
    });

  } catch (error) {
    console.error('Error fetching similar vehicles:', error);
    return res.json({ success: false, message: error.message });
  }
};
