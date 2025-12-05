// controller/ownerController.js
import Property from '../models/property.js';
import Vehicle from '../models/vehicle.js';

/**
 * Get all listings (properties + vehicles) for the logged-in owner
 * Excludes deleted items
 * GET /api/owner/listings
 */
export const getOwnerListings = async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        // Fetch properties for this owner, excluding deleted
        const properties = await Property.find({
            ownerId: userId,
            status: { $ne: 'deleted' }
        }).lean();

        // Fetch vehicles for this owner, excluding deleted
        const vehicles = await Vehicle.find({
            ownerId: userId,
            status: { $ne: 'deleted' }
        }).lean();

        // Transform and combine listings
        const propertyListings = properties.map(p => ({
            id: p._id.toString(),
            type: 'property',
            title: p.title,
            description: p.description,
            category: p.category,
            address: p.address || `${p.city}, ${p.state}`,
            city: p.city,
            state: p.state,
            country: p.country,
            price: p.price?.perMonth || p.price?.perDay || 0,
            priceType: p.price?.perMonth ? 'month' : 'day',
            currency: p.price?.currency || 'INR',
            image: p.images?.[0] || null,
            images: p.images || [],
            status: p.status,
            available: p.available,
            featured: p.Featured,
            rating: p.rating?.avg || 0,
            reviewCount: p.rating?.count || 0,
            bookings: p.meta?.bookings || 0,
            views: p.meta?.views || 0,
            bedrooms: p.bedrooms,
            bathrooms: p.bathrooms,
            areaSqft: p.areaSqft,
            furnished: p.furnished,
            amenities: p.amenities,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
        }));

        const vehicleListings = vehicles.map(v => ({
            id: v._id.toString(),
            type: 'vehicle',
            title: `${v.make} ${v.model} (${v.year})`,
            description: `${v.vehicleType} - ${v.fuelType || 'N/A'} - ${v.transmission || 'N/A'}`,
            category: v.vehicleType,
            address: v.location?.address || `${v.location?.city}, ${v.location?.state}`,
            city: v.location?.city,
            state: v.location?.state,
            country: v.location?.country,
            price: v.price?.perDay || v.price?.perHour || 0,
            priceType: v.price?.perDay ? 'day' : 'hour',
            currency: v.price?.currency || 'INR',
            image: v.photos?.[0] || null,
            images: v.photos || [],
            status: v.status,
            available: v.available,
            featured: v.Featured,
            rating: v.rating?.avg || 0,
            reviewCount: v.rating?.count || 0,
            bookings: 0, // Vehicles don't have meta.bookings yet
            views: 0,
            // Vehicle specific
            vehicleType: v.vehicleType,
            make: v.make,
            model: v.model,
            year: v.year,
            fuelType: v.fuelType,
            transmission: v.transmission,
            seats: v.seats,
            color: v.color,
            mileage: v.mileage,
            createdAt: v.createdAt,
            updatedAt: v.updatedAt,
        }));

        // Combine all listings
        const allListings = [...propertyListings, ...vehicleListings];

        // Calculate counts for each status
        const counts = {
            all: allListings.length,
            active: allListings.filter(l => l.status === 'active').length,
            inactive: allListings.filter(l => l.status === 'inactive').length,
            pending: allListings.filter(l => l.status === 'suspended').length,
        };

        return res.json({
            success: true,
            listings: allListings,
            counts,
            message: 'Listings fetched successfully'
        });

    } catch (error) {
        console.log('Error fetching owner listings:', error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};
