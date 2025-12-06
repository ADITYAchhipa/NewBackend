// filterController.js - Search filter API for properties
import Property from '../models/property.js';

/**
 * POST /api/filter/properties
 * Search and filter properties with pagination
 * 
 * Request body:
 * - categoryType: string (residential, commercial, venue)
 * - category: string[] (property types)
 * - minPrice: number (per day)
 * - maxPrice: number (per day)
 * - minArea: number (sqft)
 * - maxArea: number (sqft)
 * - furnished: string (unfurnished, semi-furnished, furnished)
 * - amenities: string[] (general amenities)
 * - essentialAmenities: string[] (essential amenities filter)
 * - page: number (default 1)
 * - limit: number (default 10)
 */
export const filterProperties = async (req, res) => {
    try {
        const {
            categoryType,
            category,
            minPrice,
            maxPrice,
            minArea,
            maxArea,
            furnished,
            amenities,
            essentialAmenities,
            page = 1,
            limit = 10,
        } = req.body;

        // Build query object
        const query = { status: 'active' };

        // Category Type filter
        if (categoryType && categoryType !== 'any') {
            query.categoryType = categoryType;
        }

        // Category (property type) filter - supports multiple selection
        if (category && Array.isArray(category) && category.length > 0) {
            // Filter out 'any' or 'all' from the array
            const validCategories = category.filter(c => c !== 'any' && c !== 'all');
            if (validCategories.length > 0) {
                query.category = { $in: validCategories };
            }
        }

        // Budget filter (price.perDay) with min/max validation
        if (minPrice !== undefined || maxPrice !== undefined) {
            query['price.perDay'] = {};
            if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
                query['price.perDay'].$gte = Number(minPrice);
            }
            if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
                query['price.perDay'].$lte = Number(maxPrice);
            }
            // Remove empty object if no constraints
            if (Object.keys(query['price.perDay']).length === 0) {
                delete query['price.perDay'];
            }
        }

        // Built-up Area filter with min/max validation
        if (minArea !== undefined || maxArea !== undefined) {
            query.areaSqft = {};
            if (minArea !== undefined && minArea !== null && minArea !== '') {
                query.areaSqft.$gte = Number(minArea);
            }
            if (maxArea !== undefined && maxArea !== null && maxArea !== '') {
                query.areaSqft.$lte = Number(maxArea);
            }
            // Remove empty object if no constraints
            if (Object.keys(query.areaSqft).length === 0) {
                delete query.areaSqft;
            }
        }

        // Furnished filter
        if (furnished && furnished !== 'any') {
            query.furnished = furnished;
        }

        // Amenities filter - must have ALL selected amenities
        if (amenities && Array.isArray(amenities) && amenities.length > 0) {
            query.amenities = { $all: amenities };
        }

        // Essential Amenities filter - must have ALL selected essential amenities
        if (essentialAmenities && Array.isArray(essentialAmenities) && essentialAmenities.length > 0) {
            query.essentialAmenities = { $all: essentialAmenities };
        }

        // Pagination
        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10))); // Max 50 per page
        const skip = (pageNum - 1) * limitNum;

        // Get total count for pagination info
        const total = await Property.countDocuments(query);
        const totalPages = Math.ceil(total / limitNum);

        // Fetch properties with pagination
        const properties = await Property.find(query)
            .sort({ createdAt: -1 }) // Newest first
            .skip(skip)
            .limit(limitNum)
            .populate('ownerId', 'name email avatar');

        res.status(200).json({
            success: true,
            data: properties,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1,
            },
        });
    } catch (error) {
        console.error('Filter properties error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to filter properties',
            error: error.message,
        });
    }
};

/**
 * GET /api/filter/options
 * Get available filter options (for dropdowns)
 */
export const getFilterOptions = async (req, res) => {
    try {
        const options = {
            categoryTypes: ['residential', 'commercial', 'venue'],
            categories: {
                residential: ['apartment', 'house', 'villa', 'studio', 'townhouse', 'condo', 'room', 'pg', 'hostel', 'duplex', 'penthouse', 'bungalow'],
                commercial: ['office', 'shop', 'warehouse', 'coworking', 'showroom', 'clinic', 'restaurant', 'cafe'],
                venue: ['banquet_hall', 'wedding_venue', 'party_hall', 'conference_room', 'meeting_room', 'auditorium', 'theater', 'garden', 'rooftop', 'ballroom', 'resort', 'farmhouse', 'studio_venue', 'exhibition', 'club', 'dining_room'],
            },
            furnished: ['unfurnished', 'semi-furnished', 'furnished'],
            essentialAmenities: ['wifi', 'parking', 'ac', 'gym', 'swimming_pool', 'power_backup', 'lift', 'security', 'garden', 'water_supply', 'gas', 'cctv'],
        };

        res.status(200).json({
            success: true,
            data: options,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get filter options',
            error: error.message,
        });
    }
};
