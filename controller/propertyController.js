// controller/propertyController.js
import Property from '../models/property.js';



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

    return res.json({
      success: true,
      property
    });

  } catch (error) {
    console.error('Error fetching property:', error);
    res.json({ success: false, message: error.message });
  }
};
