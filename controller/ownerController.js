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
        const propertyListings = properties.map(p => {
            console.log(`[OWNER LISTINGS] Property: ${p.title}, Images:`, p.images);
            return {
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
            };
        });

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

/**
 * Create a new property listing
 * POST /api/owner/property
 */
export const createPropertyListing = async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const propertyData = {
            ...req.body,
            ownerId: userId,
            status: 'active',
            available: true,
        };

        // Handle locationGeo - remove if coordinates are missing or empty to avoid geo index error
        if (propertyData.locationGeo) {
            const geo = propertyData.locationGeo;
            const coords = geo.coordinates;
            // Remove if: no coordinates key, not an array, less than 2 elements, or null/undefined values
            if (!geo.hasOwnProperty('coordinates') ||
                !coords ||
                !Array.isArray(coords) ||
                coords.length < 2 ||
                coords[0] == null || coords[1] == null) {
                delete propertyData.locationGeo;
                console.log('Removed invalid locationGeo:', geo);
            }
        }

        // Create the property
        const property = new Property(propertyData);
        await property.save();

        // Increment user's property listing count
        const User = (await import('../models/user.js')).default;
        await User.findByIdAndUpdate(userId, {
            $inc: {
                TotalPropertyListings: 1,
                ActiveListings: 1
            }
        });

        // Transform property to listing format for frontend
        const listing = {
            id: property._id.toString(),
            type: 'property',
            title: property.title,
            description: property.description,
            category: property.category,
            address: property.address || `${property.city}, ${property.state}`,
            city: property.city,
            state: property.state,
            country: property.country,
            price: property.price?.perMonth || property.price?.perDay || 0,
            priceType: property.price?.perMonth ? 'month' : 'day',
            currency: property.price?.currency || 'INR',
            image: property.images?.[0] || null,
            images: property.images || [],
            status: property.status,
            available: property.available,
            featured: property.Featured,
            rating: property.rating?.avg || 0,
            reviewCount: property.rating?.count || 0,
            bookings: 0,
            views: 0,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            areaSqft: property.areaSqft,
            furnished: property.furnished,
            amenities: property.amenities,
            createdAt: property.createdAt,
            updatedAt: property.updatedAt,
        };

        console.log('✅ Property listing created:', property._id);

        return res.status(201).json({
            success: true,
            listing,
            message: 'Property listing created successfully'
        });

    } catch (error) {
        console.error('Error creating property listing:', error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Create a new vehicle listing
 * POST /api/owner/vehicle
 */
export const createVehicleListing = async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const vehicleData = {
            ...req.body,
            ownerId: userId,
            status: 'active',
            available: true,
        };

        // Create the vehicle
        const vehicle = new Vehicle(vehicleData);
        await vehicle.save();

        // Increment user's vehicle listing count
        const User = (await import('../models/user.js')).default;
        await User.findByIdAndUpdate(userId, {
            $inc: {
                TotalVehicleListings: 1,
                ActiveListings: 1
            }
        });

        // Transform vehicle to listing format for frontend
        const listing = {
            id: vehicle._id.toString(),
            type: 'vehicle',
            title: `${vehicle.make} ${vehicle.model} (${vehicle.year})`,
            description: `${vehicle.vehicleType} - ${vehicle.fuelType || 'N/A'} - ${vehicle.transmission || 'N/A'}`,
            category: vehicle.vehicleType,
            address: vehicle.location?.address || `${vehicle.location?.city}, ${vehicle.location?.state}`,
            city: vehicle.location?.city,
            state: vehicle.location?.state,
            country: vehicle.location?.country,
            price: vehicle.price?.perDay || vehicle.price?.perHour || 0,
            priceType: vehicle.price?.perDay ? 'day' : 'hour',
            currency: vehicle.price?.currency || 'INR',
            image: vehicle.photos?.[0] || null,
            images: vehicle.photos || [],
            status: vehicle.status,
            available: vehicle.available,
            featured: vehicle.Featured,
            rating: vehicle.rating?.avg || 0,
            reviewCount: vehicle.rating?.count || 0,
            bookings: 0,
            views: 0,
            vehicleType: vehicle.vehicleType,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            fuelType: vehicle.fuelType,
            transmission: vehicle.transmission,
            seats: vehicle.seats,
            color: vehicle.color,
            mileage: vehicle.mileage,
            createdAt: vehicle.createdAt,
            updatedAt: vehicle.updatedAt,
        };

        console.log('✅ Vehicle listing created:', vehicle._id);

        return res.status(201).json({
            success: true,
            listing,
            message: 'Vehicle listing created successfully'
        });

    } catch (error) {
        console.error('Error creating vehicle listing:', error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get all bookings for properties/vehicles owned by the authenticated user
 * Returns bookings categorized by status: pending, inProgress, confirmed, completed, cancelled
 * GET /api/owner/bookings
 */
export const getOwnerBookings = async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        console.log(`[OWNER BOOKINGS] Fetching bookings for owner: ${userId}`);

        // Get all properties and vehicles owned by this user
        const properties = await Property.find({ ownerId: userId }).select('_id title images').lean();
        const vehicles = await Vehicle.find({ ownerId: userId }).select('_id make model year photos').lean();

        const propertyIds = properties.map(p => p._id);
        const vehicleIds = vehicles.map(v => v._id);

        console.log(`[OWNER BOOKINGS] Found ${propertyIds.length} properties and ${vehicleIds.length} vehicles`);

        // Fetch all bookings for these properties and vehicles
        let bookings = [];
        if (propertyIds.length > 0 || vehicleIds.length > 0) {
            bookings = await Booking.find({
                $or: [
                    { propertyId: { $in: propertyIds } },
                    { vehicleId: { $in: vehicleIds } }
                ]
            })
                .populate({
                    path: 'userId',
                    select: 'name email profilePicture phone rating verified',
                    model: 'User'
                })
                .populate({
                    path: 'propertyId',
                    select: 'title images location pricing rentalType',
                    model: Property
                })
                .populate({
                    path: 'vehicleId',
                    select: 'make model year photos location price',
                    model: Vehicle
                })
                .sort({ createdAt: -1 }); // Newest first
        }

        console.log(`[OWNER BOOKINGS] Found ${bookings.length} total bookings`);

        // Categorize bookings by status
        const categorized = {
            pending: [],
            inProgress: [],
            confirmed: [],
            completed: [],
            cancelled: []
        };

        bookings.forEach(booking => {
            const bookingData = {
                id: booking._id,
                userId: booking.userId?._id || booking.userId,
                listingId: booking.propertyId?._id || booking.vehicleId?._id,
                startDate: booking.startDate,
                endDate: booking.endDate,
                totalPrice: booking.totalPrice,
                originalPrice: booking.originalPrice,
                discountAmount: booking.discountAmount,
                couponCode: booking.couponCode,
                status: booking.status,
                paymentStatus: booking.paymentStatus,
                createdAt: booking.createdAt,
                updatedAt: booking.updatedAt,
            };

            // Add guest user details if populated
            if (booking.userId && typeof booking.userId === 'object') {
                bookingData.guest = {
                    id: booking.userId._id,
                    name: booking.userId.name,
                    email: booking.userId.email,
                    phone: booking.userId.phone,
                    avatar: booking.userId.profilePicture || '',
                    rating: booking.userId.rating?.avg || 0,
                    verified: booking.userId.verified || false
                };
            }

            // Add property or vehicle details
            if (booking.propertyId) {
                bookingData.type = 'property';
                bookingData.listingName = booking.propertyId.title;
                bookingData.listingImage = booking.propertyId.images?.[0] || '';
                bookingData.property = {
                    id: booking.propertyId._id,
                    name: booking.propertyId.title,
                    image: booking.propertyId.images?.[0] || '',
                    images: booking.propertyId.images || [],
                    location: booking.propertyId.location,
                    pricing: booking.propertyId.pricing,
                    rentalType: booking.propertyId.rentalType
                };
            } else if (booking.vehicleId) {
                bookingData.type = 'vehicle';
                bookingData.listingName = `${booking.vehicleId.make} ${booking.vehicleId.model} (${booking.vehicleId.year})`;
                bookingData.listingImage = booking.vehicleId.photos?.[0] || '';
                bookingData.vehicle = {
                    id: booking.vehicleId._id,
                    name: `${booking.vehicleId.make} ${booking.vehicleId.model}`,
                    image: booking.vehicleId.photos?.[0] || '',
                    images: booking.vehicleId.photos || [],
                    location: booking.vehicleId.location,
                    price: booking.vehicleId.price,
                    make: booking.vehicleId.make,
                    model: booking.vehicleId.model,
                    year: booking.vehicleId.year
                };
            }

            // Categorize by status
            if (booking.status === 'pending') {
                categorized.pending.push(bookingData);
            } else if (booking.status === 'inProgress') {
                categorized.inProgress.push(bookingData);
            } else if (booking.status === 'confirmed') {
                categorized.confirmed.push(bookingData);
            } else if (booking.status === 'completed') {
                categorized.completed.push(bookingData);
            } else if (booking.status === 'cancelled') {
                categorized.cancelled.push(bookingData);
            }
        });

        console.log(`[OWNER BOOKINGS] Categorized: pending=${categorized.pending.length}, inProgress=${categorized.inProgress.length}, confirmed=${categorized.confirmed.length}, completed=${categorized.completed.length}, cancelled=${categorized.cancelled.length}`);

        return res.status(200).json({
            success: true,
            bookings: categorized,
            total: bookings.length,
            message: 'Owner bookings fetched successfully'
        });

    } catch (error) {
        console.error('[OWNER BOOKINGS] Error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch owner bookings',
            error: error.message
        });
    }
};

// ==================== LISTING MANAGEMENT ACTIONS ====================

// Deactivate listing (property or vehicle)
export const deactivateListing = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { type } = req.query; // 'property' or 'vehicle'

        const Model = type === 'vehicle' ? Vehicle : Property;

        const listing = await Model.findOneAndUpdate(
            { _id: id, ownerId: userId },
            {
                status: 'inactive',
                lastDeactivatedAt: new Date()
            },
            { new: true }
        );

        if (!listing) {
            return res.status(404).json({
                success: false,
                message: 'Listing not found or you do not have permission'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Listing deactivated successfully',
            listing: {
                id: listing._id,
                status: listing.status,
                lastDeactivatedAt: listing.lastDeactivatedAt
            }
        });
    } catch (error) {
        console.error('Error deactivating listing:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to deactivate listing',
            error: error.message
        });
    }
};

// Activate listing (with 1-hour cooldown check)
export const activateListing = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { type } = req.query;

        const Model = type === 'vehicle' ? Vehicle : Property;
        const listing = await Model.findOne({ _id: id, ownerId: userId });

        if (!listing) {
            return res.status(404).json({
                success: false,
                message: 'Listing not found or you do not have permission'
            });
        }

        // Check 1-hour cooldown
        if (listing.lastDeactivatedAt) {
            const hoursSinceDeactivation = (Date.now() - new Date(listing.lastDeactivatedAt).getTime()) / (1000 * 60 * 60);

            if (hoursSinceDeactivation < 1) {
                const remainingMinutes = Math.ceil((1 - hoursSinceDeactivation) * 60);
                return res.status(400).json({
                    success: false,
                    message: `Cannot activate yet. Please wait ${remainingMinutes} more minutes.`,
                    remainingMinutes
                });
            }
        }

        listing.status = 'active';
        await listing.save();

        res.status(200).json({
            success: true,
            message: 'Listing activated successfully',
            listing: {
                id: listing._id,
                status: listing.status
            }
        });
    } catch (error) {
        console.error('Error activating listing:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to activate listing',
            error: error.message
        });
    }
};

// Delete listing
export const deleteListing = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { type } = req.query;

        const Model = type === 'vehicle' ? Vehicle : Property;
        const result = await Model.deleteOne({ _id: id, ownerId: userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Listing not found or you do not have permission'
            });
        }

        // Update user's listing count
        const User = (await import('../models/user.js')).default;
        const updateField = type === 'vehicle' ? 'TotalVehicleListings' : 'TotalPropertyListings';
        await User.findByIdAndUpdate(userId, {
            $inc: {
                [updateField]: -1,
                ActiveListings: -1
            }
        });

        res.status(200).json({
            success: true,
            message: 'Listing deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting listing:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete listing',
            error: error.message
        });
    }
};

// Feature listing with coins (300 coins cost)
export const featureListingWithCoins = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { type } = req.query;

        const Model = type === 'vehicle' ? Vehicle : Property;
        const listing = await Model.findOne({ _id: id, ownerId: userId });

        if (!listing) {
            return res.status(404).json({
                success: false,
                message: 'Listing not found or you do not have permission'
            });
        }

        // Check if already featured
        if (listing.Featured === true) {
            return res.status(200).json({
                success: true,
                alreadyFeatured: true,
                message: 'This listing is already featured!'
            });
        }

        // Check user's coin balance
        const User = (await import('../models/user.js')).default;
        const user = await User.findById(userId);

        const availableCoins = user.totalTokens || 0;
        const costCoins = 300;

        if (availableCoins < costCoins) {
            return res.status(400).json({
                success: false,
                message: `Insufficient coins. You need ${costCoins} coins but have only ${availableCoins}.`,
                required: costCoins,
                available: availableCoins
            });
        }

        // Deduct coins
        user.totalTokens -= costCoins;
        user.usedTokens = (user.usedTokens || 0) + costCoins;
        await user.save();

        // Set listing as featured
        listing.Featured = true;
        await listing.save();

        res.status(200).json({
            success: true,
            message: `Listing featured successfully! ${costCoins} coins deducted.`,
            listing: {
                id: listing._id,
                Featured: listing.Featured
            },
            coinsRemaining: user.totalTokens
        });
    } catch (error) {
        console.error('Error featuring listing:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to feature listing',
            error: error.message
        });
    }
};
