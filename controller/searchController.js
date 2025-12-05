// controllers/search.controller.js
import Vehicle from '../models/vehicle.js';
import Property from '../models/property.js';

export const searchItems = async (req, res) => {
  try {
    const { query, type } = req.query; // type = 'vehicle' or 'property'

    if (!type || !query)
      return res.status(400).json({ success: false, message: "Type and query are required" });

    let results = [];

    if (type === 'vehicle') {
      results = await Vehicle.find({
        $text: { $search: query }
      });
    } else if (type === 'property') {
      results = await Property.find({
        $text: { $search: query }
      });
    } else {
      return res.status(400).json({ success: false, message: "Invalid type parameter" });
    }

    res.status(200).json({
      success: true,
      count: results.length,
      results
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Get paginated search results with server-side sorting
 * GET /api/search/paginated?type=property|vehicle&page=1&limit=20&sort=relevance|price_asc|price_desc|rating|nearest&lat=...&lng=...
 * 
 * Sort options:
 * - relevance: booked → favorited → same city → featured → random (requires auth for full effect)
 * - price_asc: Price low to high
 * - price_desc: Price high to low
 * - rating: Rating high to low
 * - nearest: By distance from lat/lng coordinates
 */
export const getPaginatedSearchResults = async (req, res) => {
  try {
    const {
      type = 'property',
      page = 1,
      limit = 20,
      exclude = '',
      query = '',
      sort = 'relevance',
      lat,
      lng
    } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const excludeIds = exclude ? exclude.split(',').filter(id => id.trim()) : [];
    const userLat = parseFloat(lat) || null;
    const userLng = parseFloat(lng) || null;

    const Model = type === 'vehicle' ? Vehicle : Property;

    // Build base query
    let baseQuery = { available: true };

    // Exclude already fetched IDs
    if (excludeIds.length > 0) {
      baseQuery._id = { $nin: excludeIds };
    }

    // Add text search if query provided
    if (query && query.trim()) {
      baseQuery.$or = [
        { title: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { city: { $regex: query, $options: 'i' } },
        { state: { $regex: query, $options: 'i' } },
        { address: { $regex: query, $options: 'i' } }
      ];
    }

    // Get user data for relevance sorting (if authenticated)
    let userBookedIds = [];
    let userFavoriteIds = [];
    let userCity = null;

    // Check if user is authenticated (optional - extract from token if available)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Get user's favorites and city
        const User = (await import('../models/user.js')).default;
        const user = await User.findById(userId).lean();

        if (user) {
          userCity = user.City;
          if (type === 'vehicle') {
            userFavoriteIds = (user.favourites?.vehicles || []).map(id => id.toString());
          } else {
            userFavoriteIds = (user.favourites?.properties || []).map(id => id.toString());
          }

          // Get booked item IDs
          const Booking = (await import('../models/booking.js')).default;
          const bookings = await Booking.find({ userId }).lean();
          if (type === 'vehicle') {
            userBookedIds = bookings.filter(b => b.vehicleId).map(b => b.vehicleId.toString());
          } else {
            userBookedIds = bookings.filter(b => b.propertyId).map(b => b.propertyId.toString());
          }
        }
      } catch (err) {
        // Token invalid or expired - continue without user data
        console.log('Auth optional: proceeding without user context');
      }
    }

    // Get total count
    const total = await Model.countDocuments(baseQuery);

    // Fetch ALL matching items for proper sorting (we'll paginate after sorting)
    // For large datasets, consider caching or limiting to first N items
    const allItems = await Model.find(baseQuery).lean();

    // Calculate scores and sort based on selected option
    let scoredItems = allItems.map(item => {
      const itemId = item._id.toString();
      let score = 0;

      // Extract price for price-based sorting
      let price = 0;
      if (type === 'vehicle') {
        price = item.price?.perDay || item.pricePerDay || item.pricing?.daily || 0;
      } else {
        price = item.price?.perMonth || item.pricing?.monthly || item.price || 0;
      }

      // Extract rating
      const rating = item.rating?.avg || item.rating || 0;

      // Calculate distance if coordinates provided
      let distance = Infinity;
      if (userLat && userLng && item.latitude && item.longitude) {
        distance = haversineDistance(userLat, userLng, item.latitude, item.longitude);
      }

      // Calculate relevance score
      if (sort === 'relevance') {
        // Priority: Booked (1000) > Favorited (500) > Same City (100) > Featured (50) > Random
        if (userBookedIds.includes(itemId)) score += 1000;
        if (userFavoriteIds.includes(itemId)) score += 500;
        if (userCity && item.city && item.city.toLowerCase() === userCity.toLowerCase()) score += 100;
        if (item.Featured) score += 50;
        // Add small random factor to break ties
        score += Math.random() * 10;
      }

      return {
        ...item,
        _sortScore: score,
        _sortPrice: price,
        _sortRating: rating,
        _sortDistance: distance
      };
    });

    // Sort based on selected option
    switch (sort) {
      case 'price_asc':
        scoredItems.sort((a, b) => a._sortPrice - b._sortPrice);
        break;
      case 'price_desc':
        scoredItems.sort((a, b) => b._sortPrice - a._sortPrice);
        break;
      case 'rating':
        scoredItems.sort((a, b) => b._sortRating - a._sortRating);
        break;
      case 'nearest':
        scoredItems.sort((a, b) => a._sortDistance - b._sortDistance);
        break;
      case 'relevance':
      default:
        scoredItems.sort((a, b) => b._sortScore - a._sortScore);
        break;
    }

    // Apply pagination
    const skip = (pageNum - 1) * limitNum;
    const paginatedItems = scoredItems.slice(skip, skip + limitNum);
    const hasMore = (skip + paginatedItems.length) < total;

    // Transform results based on type
    const transformedResults = paginatedItems.map(item => {
      // Clean up sort fields before returning
      const { _sortScore, _sortPrice, _sortRating, _sortDistance, ...cleanItem } = item;

      if (type === 'vehicle') {
        return {
          id: cleanItem._id?.toString(),
          _id: cleanItem._id?.toString(),
          title: cleanItem.name || cleanItem.title || 'Untitled Vehicle',
          price: _sortPrice,
          rating: _sortRating,
          reviewCount: cleanItem.rating?.count || 0,
          imageUrl: cleanItem.images?.[0] || cleanItem.image || '',
          images: cleanItem.images || [],
          location: cleanItem.city ? `${cleanItem.city}, ${cleanItem.state || ''}`.trim() : (cleanItem.location || ''),
          city: cleanItem.city || '',
          state: cleanItem.state || '',
          category: cleanItem.category || cleanItem.vehicleType || '',
          seats: cleanItem.seats || cleanItem.seatCapacity || 4,
          transmission: cleanItem.transmission || 'automatic',
          fuel: cleanItem.fuelType || cleanItem.fuel || 'petrol',
          latitude: cleanItem.latitude,
          longitude: cleanItem.longitude,
          itemType: 'vehicle',
          isFeatured: cleanItem.Featured || false,
          distance: _sortDistance !== Infinity ? _sortDistance : null
        };
      } else {
        return {
          id: cleanItem._id?.toString(),
          _id: cleanItem._id?.toString(),
          title: cleanItem.title || 'Untitled Property',
          price: _sortPrice,
          rating: _sortRating,
          reviewCount: cleanItem.rating?.count || 0,
          imageUrl: cleanItem.images?.[0] || cleanItem.image || '',
          images: cleanItem.images || [],
          location: cleanItem.city ? `${cleanItem.city}, ${cleanItem.state || ''}`.trim() : (cleanItem.location || ''),
          city: cleanItem.city || '',
          state: cleanItem.state || '',
          category: cleanItem.category || cleanItem.propertyType || '',
          bedrooms: cleanItem.bedrooms || 0,
          bathrooms: cleanItem.bathrooms || 0,
          areaSqft: cleanItem.areaSqft || 0,
          amenities: cleanItem.amenities || [],
          latitude: cleanItem.latitude,
          longitude: cleanItem.longitude,
          itemType: 'property',
          isFeatured: cleanItem.Featured || false,
          distance: _sortDistance !== Infinity ? _sortDistance : null
        };
      }
    });

    res.status(200).json({
      success: true,
      data: {
        results: transformedResults,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          hasMore,
          totalPages: Math.ceil(total / limitNum),
          sort
        }
      }
    });

  } catch (error) {
    console.error('Error in getPaginatedSearchResults:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// Haversine formula to calculate distance between two coordinates in km
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
