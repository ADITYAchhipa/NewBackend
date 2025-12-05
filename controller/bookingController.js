import Booking from '../models/booking.js';
import User from '../models/user.js'
import Property from '../models/property.js';
import Vehicle from '../models/vehicle.js';

/**
 * Get all bookings for the authenticated user
 * Returns bookings categorized by status: confirmed, completed, cancelled
 */
export const getUserBookings = async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        // Fetch user with populated bookings
        const user = await User.findById(userId).select('bookings');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Get all booking IDs from user model
        const allBookingIds = [
            ...(user.bookings?.booked || []),
            ...(user.bookings?.inProgress || []),
            ...(user.bookings?.cancelled || [])
        ];

        // Fetch all bookings with populated property and vehicle data
        const bookings = await Booking.find({ _id: { $in: allBookingIds } })
            .populate({
                path: 'propertyId',
                select: 'name images location pricing rentalType',
                model: Property
            })
            .populate({
                path: 'vehicleId',
                select: 'name images location price category',
                model: Vehicle
            })
            .sort({ createdAt: -1 }); // Newest first

        // Categorize bookings by status
        const categorized = {
            confirmed: [],
            completed: [],
            cancelled: []
        };

        bookings.forEach(booking => {
            const bookingData = {
                id: booking._id,
                userId: booking.userId,
                startDate: booking.startDate,
                endDate: booking.endDate,
                totalPrice: booking.totalPrice,
                status: booking.status,
                paymentStatus: booking.paymentStatus,
                createdAt: booking.createdAt,
                updatedAt: booking.updatedAt,
            };

            // Add property or vehicle details
            if (booking.propertyId) {
                bookingData.type = 'property';
                bookingData.property = {
                    id: booking.propertyId._id,
                    name: booking.propertyId.name,
                    image: booking.propertyId.images?.[0] || '',
                    location: booking.propertyId.location,
                    pricing: booking.propertyId.pricing,
                    rentalType: booking.propertyId.rentalType
                };
            } else if (booking.vehicleId) {
                bookingData.type = 'vehicle';
                bookingData.vehicle = {
                    id: booking.vehicleId._id,
                    name: booking.vehicleId.name,
                    image: booking.vehicleId.images?.[0] || '',
                    location: booking.vehicleId.location,
                    price: booking.vehicleId.price,
                    category: booking.vehicleId.category
                };
            }

            // Categorize by status
            if (booking.status === 'confirmed') {
                categorized.confirmed.push(bookingData);
            } else if (booking.status === 'completed') {
                categorized.completed.push(bookingData);
            } else if (booking.status === 'cancelled') {
                categorized.cancelled.push(bookingData);
            }
        });

        res.status(200).json({
            success: true,
            bookings: categorized,
            total: bookings.length
        });

    } catch (error) {
        console.error('Error fetching user bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bookings',
            error: error.message
        });
    }
};
