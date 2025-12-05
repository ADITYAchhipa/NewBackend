// controller/vehicleController.js
import mongoose from 'mongoose';
import Vehicle from '../models/vehicle.js';


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
    const results = await Vehicle.aggregate([
      { $match: filter },
      { $sample: { size: Math.min(total - excludeIdsArray.length, limitNum) } }  // Random sample
    ]);

    console.log(`✅ Found ${results.length} featured vehicles (page ${pageNum}, excluded: ${excludeIdsArray.length})`);

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

    return res.json({
      success: true,
      vehicle
    });

  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.json({ success: false, message: error.message });
  }
};
