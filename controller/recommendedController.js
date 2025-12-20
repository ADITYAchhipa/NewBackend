import User from '../models/user.js';
import Property from '../models/property.js';
import Vehicle from '../models/vehicle.js';
import Booking from '../models/booking.js';

// Fields to select from User for recommendations
const RECOMMENDED_USER_FIELDS = 'name favourites visitedProperties visitedVehicles bookings';

// Simple in-memory cache with TTL
const recommendationCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(userId, category, type) {
    return `${userId}:${type}:${category}`;
}

function getFromCache(key) {
    const cached = recommendationCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    recommendationCache.delete(key);
    return null;
}

function setCache(key, data) {
    recommendationCache.set(key, {
        data,
        timestamp: Date.now()
    });
}

/**
 * Get personalized property recommendations
 * Priority: Favorites → Bookings → Visited → Random
 */
export const getRecommendedProperties = async (req, res) => {
    try {
        const userId = req.userId;
        const category = req.query.category || 'all';

        console.log(`🎯 [Recommended] Fetching recommendations for user: ${userId}, category: ${category}`);

        // Check cache first
        const cacheKey = getCacheKey(userId, category, 'properties');
        const cached = getFromCache(cacheKey);
        if (cached) {
            console.log(`📦 [Recommended] Cache hit for ${cacheKey}`);
            return res.json({
                success: true,
                results: cached,
                total: cached.length,
                cached: true,
                message: 'Recommended properties fetched from cache'
            });
        }

        // Try to find user - only populate fields that exist
        let user = null;
        try {
            user = await User.findById(userId).select(RECOMMENDED_USER_FIELDS)
                .populate('favourites.properties')
                .populate('visitedProperties.propertyId');
        } catch (populateError) {
            console.warn('⚠️ [Recommended] Error populating user data:', populateError.message);
            // Try with minimal population
            user = await User.findById(userId).select(RECOMMENDED_USER_FIELDS);
        }

        // Track used IDs to prevent duplicates
        const usedIds = new Set();
        let recommendations = [];

        // If user exists, try to get personalized recommendations
        if (user) {
            console.log(`👤 [Recommended] User found: ${user.name || 'No name'}`);

            // Step 1: Favorites (featured first)
            try {
                const favProperties = user.favourites?.properties || [];
                if (favProperties.length > 0) {
                    const favorites = await getFavoritesSorted(favProperties, usedIds, 'Property');
                    recommendations.push(...favorites);
                    console.log(`⭐ [Recommended] Added ${favorites.length} favorites`);
                }
            } catch (favError) {
                console.warn('⚠️ [Recommended] Error processing favorites:', favError.message);
            }

            // Step 2: Visited (if < 20) - Skipping bookings since Booking model doesn't exist
            if (recommendations.length < 20) {
                try {
                    const visitedProps = user.visitedProperties || [];
                    if (visitedProps.length > 0) {
                        const visited = getVisitedSorted(visitedProps, usedIds);
                        recommendations.push(...visited);
                        console.log(`👀 [Recommended] Added ${visited.length} visited properties`);
                    }
                } catch (visitError) {
                    console.warn('⚠️ [Recommended] Error processing visited:', visitError.message);
                }
            }
        } else {
            console.log(`👤 [Recommended] User not found, will return random properties`);
        }

        // Step 3: Random fill (if < 20) - this is the main source for new users
        if (recommendations.length < 20) {
            const needed = 20 - recommendations.length;
            console.log(`🎲 [Recommended] Fetching ${needed} random properties to fill recommendations`);
            const random = await getRandomProperties(usedIds, needed, category);
            recommendations.push(...random);
            console.log(`🎲 [Recommended] Added ${random.length} random properties`);
        }

        // Apply category filter if not 'all'
        if (category.toLowerCase() !== 'all') {
            recommendations = filterByCategory(recommendations, category);
            recommendations = recommendations.slice(0, 10); // Max 10 for specific category
        } else {
            recommendations = recommendations.slice(0, 20); // Max 20 for 'all'
        }

        // Cache the results
        setCache(cacheKey, recommendations);

        console.log(`✅ [Recommended] Returning ${recommendations.length} recommendations`);

        res.json({
            success: true,
            results: recommendations,
            total: recommendations.length,
            cached: false,
            message: 'Recommended properties fetched successfully'
        });

    } catch (error) {
        console.error('❌ [Recommended] Error in getRecommendedProperties:', error);

        // Fallback: Return random properties even on error
        try {
            console.log('🔄 [Recommended] Attempting fallback to random properties...');
            const category = req.query.category || 'all';
            const random = await getRandomProperties(new Set(), 20, category);

            return res.json({
                success: true,
                results: random,
                total: random.length,
                cached: false,
                fallback: true,
                message: 'Recommended properties (fallback to random)'
            });
        } catch (fallbackError) {
            console.error('❌ [Recommended] Fallback also failed:', fallbackError);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch recommended properties'
            });
        }
    }
};

/**
 * Get personalized vehicle recommendations
 * Same algorithm as properties
 */
export const getRecommendedVehicles = async (req, res) => {
    try {
        const userId = req.userId;
        const category = req.query.category || 'all';

        console.log(`🎯 [Recommended] Fetching vehicle recommendations for user: ${userId || 'anonymous'}, category: ${category}`);

        // Check cache first (only if authenticated)
        if (userId) {
            const cacheKey = getCacheKey(userId, category, 'vehicles');
            const cached = getFromCache(cacheKey);
            if (cached) {
                console.log(`📦 [Recommended] Cache hit for ${cacheKey}`);
                return res.json({
                    success: true,
                    results: cached,
                    total: cached.length,
                    cached: true,
                    message: 'Recommended vehicles fetched from cache'
                });
            }
        }

        // Track used IDs to prevent duplicates
        const usedIds = new Set();
        let recommendations = [];

        // Try to get personalized recommendations if user is authenticated
        if (userId) {
            try {
                const user = await User.findById(userId).select(RECOMMENDED_USER_FIELDS)
                    .populate('favourites.vehicles')
                    .populate('visitedVehicles.vehicleId')
                    .populate('bookings.booked')
                    .populate('bookings.cancelled');

                if (user) {
                    console.log(`👤 [Recommended] User found: ${user.name || 'No name'}`);

                    // Step 1: Favorites (featured first)
                    const favorites = await getFavoritesSorted(user.favourites?.vehicles || [], usedIds, 'Vehicle');
                    recommendations.push(...favorites);
                    console.log(`⭐ [Recommended] Added ${favorites.length} favorites`);

                    // Step 2: Bookings (if < 20)
                    if (recommendations.length < 20) {
                        const bookings = await getBookingsSorted(
                            user.bookings?.booked || [],
                            user.bookings?.cancelled || [],
                            usedIds,
                            'Vehicle'
                        );
                        recommendations.push(...bookings);
                    }

                    // Step 3: Visited (if < 20)
                    if (recommendations.length < 20) {
                        const visitedVehs = user.visitedVehicles || [];
                        if (visitedVehs.length > 0) {
                            const visited = getVisitedVehiclesSorted(visitedVehs, usedIds);
                            recommendations.push(...visited);
                            console.log(`👀 [Recommended] Added ${visited.length} visited vehicles`);
                        }
                    }
                }
            } catch (userError) {
                console.warn('⚠️ [Recommended] Error fetching user data:', userError.message);
            }
        } else {
            console.log(`👤 [Recommended] Anonymous user, will return random vehicles`);
        }

        // Step 4: Random fill (if < 20) - this is the main source for anonymous/new users
        if (recommendations.length < 20) {
            const needed = 20 - recommendations.length;
            console.log(`🎲 [Recommended] Fetching ${needed} random vehicles to fill recommendations`);
            const random = await getRandomVehicles(usedIds, needed, category);
            recommendations.push(...random);
            console.log(`🎲 [Recommended] Added ${random.length} random vehicles`);
        }

        // Apply category filter
        if (category.toLowerCase() !== 'all') {
            recommendations = filterByCategory(recommendations, category);
            recommendations = recommendations.slice(0, 10);
        } else {
            recommendations = recommendations.slice(0, 20);
        }

        // Cache the results (only if authenticated)
        if (userId) {
            const cacheKey = getCacheKey(userId, category, 'vehicles');
            setCache(cacheKey, recommendations);
        }

        console.log(`✅ [Recommended] Returning ${recommendations.length} vehicle recommendations`);

        res.json({
            success: true,
            results: recommendations,
            total: recommendations.length,
            cached: false,
            message: 'Recommended vehicles fetched successfully'
        });

    } catch (error) {
        console.error('❌ [Recommended] Error in getRecommendedVehicles:', error);

        // Fallback: Return random vehicles even on error
        try {
            console.log('🔄 [Recommended] Attempting fallback to random vehicles...');
            const category = req.query.category || 'all';
            const random = await getRandomVehicles(new Set(), 20, category);

            return res.json({
                success: true,
                results: random,
                total: random.length,
                cached: false,
                fallback: true,
                message: 'Recommended vehicles (fallback to random)'
            });
        } catch (fallbackError) {
            console.error('❌ [Recommended] Fallback also failed:', fallbackError);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch recommended vehicles'
            });
        }
    }
};

/**
 * Clear recommendation cache for a user
 */
export const clearRecommendationCache = async (req, res) => {
    try {
        const userId = req.userId;

        // Clear all cache entries for this user
        const keysToDelete = [];
        for (const key of recommendationCache.keys()) {
            if (key.startsWith(userId)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => recommendationCache.delete(key));

        res.json({
            success: true,
            message: `Cleared ${keysToDelete.length} cache entries`
        });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to clear cache'
        });
    }
};

// ============= Helper Functions =============

/**
 * Sort favorites: Featured first, then non-featured
 */
async function getFavoritesSorted(favorites, usedIds, modelType) {
    if (!favorites || favorites.length === 0) return [];

    const Model = modelType === 'Property' ? Property : Vehicle;

    // Get full details if not already populated
    let items = favorites;
    if (favorites.length > 0 && !favorites[0].title) {
        const ids = favorites.map(f => f._id || f);
        items = await Model.find({ _id: { $in: ids } }).populate('ownerId', 'name avatar phone');
    }

    // Sort: Featured first
    const sorted = items.sort((a, b) => {
        if (a.Featured === b.Featured) return 0;
        return a.Featured ? -1 : 1; // Featured items first
    });

    // Filter out already used and add to usedIds
    const result = [];
    for (const item of sorted) {
        const id = item._id.toString();
        if (!usedIds.has(id)) {
            usedIds.add(id);
            result.push(item);
        }
    }

    return result;
}

/**
 * Sort bookings: booked+featured, booked+non, cancelled+featured, cancelled+non
 */
async function getBookingsSorted(bookedArray, cancelledArray, usedIds, modelType) {
    const Model = modelType === 'Property' ? Property : Vehicle;

    // Get property/vehicle IDs from bookings
    const bookedIds = new Set();
    const cancelledIds = new Set();

    // Extract IDs from booked bookings
    for (const booking of bookedArray) {
        const itemId = booking.propertyId || booking.vehicleId;
        if (itemId) bookedIds.add(itemId.toString());
    }

    // Extract IDs from cancelled bookings
    for (const booking of cancelledArray) {
        const itemId = booking.propertyId || booking.vehicleId;
        if (itemId) cancelledIds.add(itemId.toString());
    }

    // Fetch all items
    const allIds = [...bookedIds, ...cancelledIds];
    if (allIds.length === 0) return [];

    const items = await Model.find({ _id: { $in: allIds } }).populate('ownerId', 'name avatar phone');

    // Categorize
    const bookedFeatured = [];
    const bookedNonFeatured = [];
    const cancelledFeatured = [];
    const cancelledNonFeatured = [];

    for (const item of items) {
        const id = item._id.toString();
        if (usedIds.has(id)) continue; // Skip duplicates

        const isBooked = bookedIds.has(id);
        const isFeatured = item.Featured;

        if (isBooked && isFeatured) bookedFeatured.push(item);
        else if (isBooked && !isFeatured) bookedNonFeatured.push(item);
        else if (!isBooked && isFeatured) cancelledFeatured.push(item);
        else cancelledNonFeatured.push(item);

        usedIds.add(id);
    }

    return [...bookedFeatured, ...bookedNonFeatured, ...cancelledFeatured, ...cancelledNonFeatured];
}

/**
 * Get visited properties (already sorted by most recent)
 */
function getVisitedSorted(visitedArray, usedIds) {
    if (!visitedArray || visitedArray.length === 0) return [];

    const result = [];
    for (const visit of visitedArray) {
        const property = visit.propertyId;
        if (!property) continue;

        const id = property._id.toString();
        if (!usedIds.has(id)) {
            usedIds.add(id);
            result.push(property);
        }
    }

    return result;
}

/**
 * Get visited vehicles (already sorted by most recent)
 */
function getVisitedVehiclesSorted(visitedArray, usedIds) {
    if (!visitedArray || visitedArray.length === 0) return [];

    const result = [];
    for (const visit of visitedArray) {
        const vehicle = visit.vehicleId;
        if (!vehicle) continue;

        const id = vehicle._id.toString();
        if (!usedIds.has(id)) {
            usedIds.add(id);
            result.push(vehicle);
        }
    }

    return result;
}

/**
 * Get random properties not already in usedIds
 */
async function getRandomProperties(usedIds, count, category) {
    if (count <= 0) return [];

    const query = {
        _id: { $nin: Array.from(usedIds) },
        status: 'active',
        available: true
    };

    // Add category filter if not 'all'
    if (category && category.toLowerCase() !== 'all') {
        let categoryValue = category;
        if (category.endsWith('s') && category !== 'Others') {
            categoryValue = category.slice(0, -1);
        }
        query.category = categoryValue.toLowerCase();
    }

    const properties = await Property.aggregate([
        { $match: query },
        { $sample: { size: count } },
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
    ]);

    // Add to usedIds
    properties.forEach(p => usedIds.add(p._id.toString()));

    return properties;
}

/**
 * Get random vehicles not already in usedIds
 */
async function getRandomVehicles(usedIds, count, category) {
    if (count <= 0) return [];

    const query = {
        _id: { $nin: Array.from(usedIds) },
        status: 'active',
        available: true
    };

    // Filter by vehicleType for vehicles (not 'category')
    if (category && category.toLowerCase() !== 'all') {
        let categoryValue = category.toLowerCase();
        // Handle plural forms: 'cars' -> 'car', 'bikes' -> 'bike'
        if (categoryValue.endsWith('s')) {
            categoryValue = categoryValue.slice(0, -1);
        }
        query.vehicleType = categoryValue;
    }

    const vehicles = await Vehicle.aggregate([
        { $match: query },
        { $sample: { size: count } },
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
    ]);

    vehicles.forEach(v => usedIds.add(v._id.toString()));

    return vehicles;
}

/**
 * Filter items by category
 */
function filterByCategory(items, category) {
    if (!category || category.toLowerCase() === 'all') return items;

    // Handle plural to singular conversion
    let categoryValue = category;
    if (category.endsWith('s') && category !== 'Others') {
        categoryValue = category.slice(0, -1);
    }
    categoryValue = categoryValue.toLowerCase();

    return items.filter(item => {
        // For properties, use 'category'; for vehicles, use 'vehicleType'
        const itemCategory = item.category || item.vehicleType;
        return itemCategory && itemCategory.toLowerCase() === categoryValue;
    });
}
