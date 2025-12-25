// controller/propertyController.js
import Property from '../models/property.js';
import { getSimilarProperties as findSimilarProperties } from '../utils/recommendationAlgorithm.js';
import { setCachePublic } from '../utils/cacheHeaders.js';


export const searchItems = async (req, res) => {
  try {
    console.log('🏠 Fetching featured properties...');
    let { category, page = 1, limit = 10, excludeIds = '' } = req.query;

    // Parse excludeIds (comma-separated string to array)
    const excludeIdsArray = excludeIds ? excludeIds.split(',').filter(id => id) : [];

    // Build query filter
    const filter = {
      Featured: true,
      available: true,  // Only available properties
      status: 'active',  // Only active properties
      _id: { $nin: excludeIdsArray }  // Exclude already-fetched IDs
    };

    // Add category filter if provided
    if (category) {
      category = category.slice(0, -1).toLowerCase();
      filter.category = category;
    }

    console.log('Query filter:', filter);

    // Count total matching documents
    const total = await Property.countDocuments(filter);

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Fetch properties with random ordering
    // Using MongoDB aggregation for better randomization
    // Only return card-essential fields for optimized list loading
    const results = await Property.aggregate([
      { $match: filter },
      { $sample: { size: Math.min(total - excludeIdsArray.length, limitNum) } },
      {
        $project: {
          _id: 1,
          title: 1,
          images: { $slice: ['$images', 1] }, // Only first image for card
          'price.perMonth': 1,
          'price.perDay': 1,
          'rating.avg': 1,
          'rating.count': 1,
          city: 1,
          state: 1,
          address: 1,
          category: 1,
          categoryType: 1,
          bedrooms: 1,
          bathrooms: 1,
          areaSqft: 1,
          Featured: 1,
          available: 1
        }
      }
    ]);

    console.log(`✅ Found ${results.length} featured properties (page ${pageNum}, excluded: ${excludeIdsArray.length})`);

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
    console.error('❌ Error fetching featured properties:', error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get property by ID
export const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.json({ success: false, message: 'Property ID is required' });
    }

    const property = await Property.findById(id)
      .populate('ownerId', 'name email phone avatar');

    if (!property) {
      return res.json({ success: false, message: 'Property not found' });
    }

    // Increment view count
    property.meta.views = (property.meta.views || 0) + 1;
    await property.save();

    // Set public cache headers (shorter TTL for individual properties: 2 minutes)
    setCachePublic(res, 120);

    return res.json({
      success: true,
      property
    });

  } catch (error) {
    console.error('Error fetching property:', error);
    res.json({ success: false, message: error.message });
  }
};

// Get similar properties based on smart recommendation algorithm
export const getSimilarProperties = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 6 } = req.query;

    console.log(`🔍 Finding similar properties for: ${id}`);

    if (!id) {
      return res.json({ success: false, message: 'Property ID is required' });
    }

    // Get the base property
    const baseProperty = await Property.findById(id);
    if (!baseProperty) {
      return res.json({ success: false, message: 'Property not found' });
    }

    console.log(`Base property: ${baseProperty.title}, category: ${baseProperty.category}`);

    // Get all available properties - be lenient with filters to get more results
    const filter = {
      available: true,
      status: 'active',
      // Don't filter by categoryType - let the algorithm score by category instead
    };

    const allProperties = await Property.find(filter)
      .select('_id title images price rating city state category categoryType bedrooms bathrooms furnished amenities ownerId')
      .limit(150) // Increase limit for better matches
      .lean();

    console.log(`Found ${allProperties.length} potential matches`);

    // Use recommendation algorithm to find similar properties
    const similarWithScores = findSimilarProperties(baseProperty.toObject(), allProperties, parseInt(limit));

    // Extract just the properties (without scores for client)
    const similar = similarWithScores.map(item => item.property);

    console.log(`✅ Returning ${similar.length} similar properties`);

    return res.json({
      success: true,
      count: similar.length,
      results: similar
    });

  } catch (error) {
    console.error('Error fetching similar properties:', error);
    return res.json({ success: false, message: error.message });
  }
};
