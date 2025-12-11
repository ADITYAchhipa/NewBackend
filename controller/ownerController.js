// controller/ownerController.js
import Property from '../models/property.js';
import Vehicle from '../models/vehicle.js';
import Booking from '../models/booking.js';

/**
 * Get dashboard stats for the logged-in owner
 * Returns: totalEarnings, availableBalance, totalBookings, activeListings, monthlyBookings
 * GET /api/owner/dashboard-stats
 */
export const getOwnerDashboardStats = async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        // Fetch owner's properties and vehicles
        const properties = await Property.find({
            ownerId: userId,
            status: { $ne: 'deleted' }
        }).lean();

        const vehicles = await Vehicle.find({
            ownerId: userId,
            status: { $ne: 'deleted' }
        }).lean();

        const propertyIds = properties.map(p => p._id);
        const vehicleIds = vehicles.map(v => v._id);

        // Calculate date ranges
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // --- Total Bookings (all time, confirmed + completed) ---
        const allBookingsQuery = {
            $or: [
                { propertyId: { $in: propertyIds } },
                { vehicleId: { $in: vehicleIds } }
            ],
            status: { $in: ['confirmed', 'completed'] }
        };

        // Only query if owner has assets
        let allBookings = [];
        if (propertyIds.length > 0 || vehicleIds.length > 0) {
            allBookings = await Booking.find(allBookingsQuery).lean();
        }

        const totalBookings = allBookings.length;

        // --- Monthly Bookings (current month) ---
        let monthlyBookings = 0;
        if (propertyIds.length > 0 || vehicleIds.length > 0) {
            monthlyBookings = await Booking.countDocuments({
                $or: [
                    { propertyId: { $in: propertyIds } },
                    { vehicleId: { $in: vehicleIds } }
                ],
                status: { $in: ['confirmed', 'completed'] },
                createdAt: { $gte: monthStart, $lte: monthEnd }
            });
        }

        // --- Total Earnings (sum of totalPrice from all confirmed/completed bookings) ---
        const totalEarnings = allBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

        // --- Monthly Earnings ---
        const monthlyEarnings = allBookings
            .filter(b => {
                const created = new Date(b.createdAt);
                return created >= monthStart && created <= monthEnd;
            })
            .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

        // --- Active Listings ---
        const activeProperties = properties.filter(p => p.status === 'active' && p.available !== false).length;
        const activeVehicles = vehicles.filter(v => v.status === 'active' && v.available !== false).length;
        const activeListings = activeProperties + activeVehicles;

        // --- Total Listings ---
        const totalListings = properties.length + vehicles.length;

        // --- Available Balance (earnings minus platform fees - mock 10% fee for now) ---
        // In a real system, this would come from a payments/payout tracking system
        const platformFeePercent = 0.10;
        const availableBalance = Math.round(totalEarnings * (1 - platformFeePercent) * 100) / 100;

        // --- Pending Payouts (mock - would come from payment system) ---
        const pendingPayouts = availableBalance * 0.3; // 30% pending

        // --- Average Rating ---
        const allRatings = [
            ...properties.map(p => p.rating?.avg || 0),
            ...vehicles.map(v => v.rating?.avg || 0)
        ].filter(r => r > 0);
        const averageRating = allRatings.length > 0
            ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
            : 0;

        // --- Occupancy Rate (booked days / available days in last 30 days) ---
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const recentBookings = allBookings.filter(b => new Date(b.createdAt) >= thirtyDaysAgo);

        let totalBookedDays = 0;
        recentBookings.forEach(booking => {
            const bookingStart = new Date(booking.startDate);
            const bookingEnd = new Date(booking.endDate);
            const bookedDays = Math.max(1, Math.ceil((bookingEnd - bookingStart) / (1000 * 60 * 60 * 24)));
            totalBookedDays += bookedDays;
        });

        const maxPossibleDays = totalListings * 30;
        const occupancyRate = maxPossibleDays > 0
            ? Math.round((totalBookedDays / maxPossibleDays) * 100) / 100
            : 0;

        // --- Pending Requests (bookings with 'pending' status - if you have it) ---
        let pendingRequests = 0;
        if (propertyIds.length > 0 || vehicleIds.length > 0) {
            pendingRequests = await Booking.countDocuments({
                $or: [
                    { propertyId: { $in: propertyIds } },
                    { vehicleId: { $in: vehicleIds } }
                ],
                status: 'pending'
            });
        }

        return res.json({
            success: true,
            data: {
                totalEarnings,
                monthlyEarnings,
                availableBalance,
                pendingPayouts,
                totalBookings,
                monthlyBookings,
                activeListings,
                totalListings,
                pendingRequests,
                averageRating,
                occupancyRate,
                currency: 'INR'
            },
            message: 'Dashboard stats fetched successfully'
        });

    } catch (error) {
        console.error('Error fetching owner dashboard stats:', error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

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
