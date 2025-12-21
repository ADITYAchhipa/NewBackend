import Booking from '../models/booking.js';
import User from '../models/user.js'
import Property from '../models/property.js';
import Vehicle from '../models/vehicle.js';
import BlockedRange from '../models/blockedRange.js';
import mongoose from 'mongoose';
import { validateDateFormat, normalizeDate, generateDateArray } from '../utils/dateUtils.js';

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
                select: 'title images location pricing rentalType ownerId',
                model: Property,
                populate: {
                    path: 'ownerId',
                    model: 'User',
                    select: 'name profilePicture rating verified'
                }
            })
            .populate({
                path: 'vehicleId',
                select: 'name images location price category ownerId',
                model: Vehicle,
                populate: {
                    path: 'ownerId',
                    model: 'User',
                    select: 'name profilePicture rating verified'
                }
            })
            .sort({ createdAt: -1 }); // Newest first

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
                    name: booking.propertyId.title, // Property model uses 'title' field
                    image: booking.propertyId.images?.[0] || '',
                    location: booking.propertyId.location,
                    pricing: booking.propertyId.pricing,
                    rentalType: booking.propertyId.rentalType
                };
                // Add owner/host data if populated
                if (booking.propertyId.ownerId) {
                    bookingData.owner = {
                        id: booking.propertyId.ownerId._id,
                        name: booking.propertyId.ownerId.name,
                        avatar: booking.propertyId.ownerId.profilePicture || '',
                        rating: booking.propertyId.ownerId.rating?.avg || 0,
                        verified: booking.propertyId.ownerId.verified || false
                    };
                }
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
                // Add owner/host data if populated
                if (booking.vehicleId.ownerId) {
                    bookingData.owner = {
                        id: booking.vehicleId.ownerId._id,
                        name: booking.vehicleId.ownerId.name,
                        avatar: booking.vehicleId.ownerId.profilePicture || '',
                        rating: booking.vehicleId.ownerId.rating?.avg || 0,
                        verified: booking.vehicleId.ownerId.verified || false
                    };
                }
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

/**
 * Create a test booking (bypasses actual payment)
 * Used for testing/development purposes only
 * - Creates booking with 'inProgress' status
 * - Adds booking to user's inProgress bookings array
 * - Adds totalPrice to owner's PendingBalance
 */
export const createTestBooking = async (req, res) => {
    console.log('[TEST BOOKING API] Request received');
    console.log('[TEST BOOKING API] Body:', JSON.stringify(req.body));

    try {
        const userId = req.userId; // From auth middleware
        console.log('[TEST BOOKING API] userId from auth:', userId);

        if (!userId) {
            console.log('[TEST BOOKING API] No userId - returning 401');
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const {
            propertyId,
            vehicleId,
            startDate,
            endDate,
            totalPrice,
            originalPrice,
            couponCode,
            discountAmount
        } = req.body;

        // Validate required fields
        if (!startDate || !endDate || totalPrice === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: startDate, endDate, totalPrice'
            });
        }

        if (!propertyId && !vehicleId) {
            return res.status(400).json({
                success: false,
                message: 'Either propertyId or vehicleId is required'
            });
        }

        // Get owner ID from property or vehicle
        let ownerId = null;
        let listingName = '';

        if (propertyId) {
            const property = await Property.findById(propertyId).select('ownerId name');
            if (!property) {
                return res.status(404).json({ success: false, message: 'Property not found' });
            }
            ownerId = property.ownerId;
            listingName = property.name;
        } else if (vehicleId) {
            const vehicle = await Vehicle.findById(vehicleId).select('ownerId name');
            if (!vehicle) {
                return res.status(404).json({ success: false, message: 'Vehicle not found' });
            }
            ownerId = vehicle.ownerId;
            listingName = vehicle.name;
        }

        if (!ownerId) {
            return res.status(400).json({
                success: false,
                message: 'Unable to determine owner of the listing'
            });
        }

        // Create the booking with 'pending' status (awaiting owner approval)
        const booking = new Booking({
            userId,
            ownerId,
            propertyId: propertyId || undefined,
            vehicleId: vehicleId || undefined,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            totalPrice,
            originalPrice: originalPrice || totalPrice,
            couponCode: couponCode || undefined,
            discountAmount: discountAmount || 0,
            status: 'pending', // Changed from 'inProgress' - bookings need owner approval
            paymentStatus: 'pending' // Payment pending for test mode
        });

        await booking.save();

        // Add booking to user's inProgress array
        await User.findByIdAndUpdate(userId, {
            $push: { 'bookings.inProgress': booking._id },
            $inc: { TotalBookings: 1 }
        });

        // Add totalPrice to owner's PendingBalance
        await User.findByIdAndUpdate(ownerId, {
            $inc: { PendingBalance: totalPrice }
        });

        console.log(`[TEST BOOKING] Created booking ${booking._id} for user ${userId}`);
        console.log(`[TEST BOOKING] Added ${totalPrice} to owner ${ownerId} PendingBalance`);

        res.status(201).json({
            success: true,
            message: 'Test booking created successfully',
            booking: {
                id: booking._id,
                listingName,
                startDate: booking.startDate,
                endDate: booking.endDate,
                totalPrice: booking.totalPrice,
                status: booking.status,
                paymentStatus: booking.paymentStatus
            }
        });

    } catch (error) {
        console.error('Error creating test booking:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create test booking',
            error: error.message
        });
    }
};

/**
 * Cancel a booking
 * - Fetches booking data from DB (never trusts frontend)
 * - Updates booking status to 'cancelled'
 * - Moves booking from user's inProgress to cancelled
 * - Deducts booking amount from owner's pendingBalance
 * - Sends email alert if pendingBalance goes negative
 * - Allows negative balance (no blocking)
 */
export const cancelBooking = async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware
        const { bookingId } = req.body;

        console.log(`[CANCEL BOOKING] User ${userId} cancelling booking ${bookingId}`);

        if (!bookingId) {
            return res.status(400).json({ success: false, message: 'Booking ID is required' });
        }

        // Fetch booking from database (NEVER trust frontend data)
        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Verify booking belongs to this user
        if (booking.userId.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
        }

        // Check if booking can be cancelled
        if (booking.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
        }

        if (booking.status === 'completed') {
            return res.status(400).json({ success: false, message: 'Cannot cancel completed booking' });
        }

        // Get owner ID from property or vehicle
        let ownerId;
        if (booking.propertyId) {
            const property = await Property.findById(booking.propertyId).select('ownerId');
            ownerId = property?.ownerId;
        } else if (booking.vehicleId) {
            const vehicle = await Vehicle.findById(booking.vehicleId).select('ownerId');
            ownerId = vehicle?.ownerId;
        }

        if (!ownerId) {
            console.error(`[CANCEL BOOKING] Owner not found for booking ${bookingId}`);
            return res.status(500).json({ success: false, message: 'Owner not found for this booking' });
        }

        // Get booking total price from DB (NEVER trust frontend)
        const bookingAmount = booking.totalPrice;
        console.log(`[CANCEL BOOKING] Deducting ₹${bookingAmount} from owner ${ownerId} pending balance`);

        // CRITICAL: Remove blockedRange if booking was confirmed
        if (booking.status === 'confirmed') {
            const deleteResult = await BlockedRange.deleteOne({ bookingId: booking._id });
            if (deleteResult.deletedCount > 0) {
                console.log(`🔓 [DATES UNBLOCKED] Booking ${booking._id}`);
            }
        }

        // UPDATE 1: Change booking status to cancelled
        booking.status = 'cancelled';
        await booking.save();

        // UPDATE 2: Move booking from user's inProgress to cancelled
        const user = await User.findById(userId);
        if (user) {
            // Remove from inProgress
            user.bookings.inProgress = user.bookings.inProgress.filter(
                id => id.toString() !== bookingId.toString()
            );

            // Add to cancelled if not already there
            if (!user.bookings.cancelled.includes(bookingId)) {
                user.bookings.cancelled.push(bookingId);
            }

            await user.save();
            console.log(`[CANCEL BOOKING] Moved booking from inProgress to cancelled in user ${userId}`);
        }

        // UPDATE 3: Deduct amount from owner's pendingBalance
        const owner = await User.findById(ownerId);
        if (owner) {
            const oldBalance = owner.PendingBalance || 0;
            const newBalance = oldBalance - bookingAmount;

            owner.PendingBalance = newBalance;
            await owner.save();

            console.log(`[CANCEL BOOKING] Owner ${ownerId} balance: ₹${oldBalance} → ₹${newBalance}`);

            // UPDATE 4: Send email alert if balance goes negative
            if (newBalance < 0 && oldBalance >= 0) {
                console.log(`[CANCEL BOOKING] ⚠️ Balance went negative! Sending email alert...`);

                // Import email service dynamically to avoid circular dependencies
                const { sendNegativeBalanceAlert } = await import('../utils/emailService.js');
                await sendNegativeBalanceAlert(ownerId.toString(), newBalance);
            }
        }

        console.log(`[CANCEL BOOKING] ✅ Booking ${bookingId} cancelled successfully`);

        res.status(200).json({
            success: true,
            message: 'Booking cancelled successfully',
            booking: {
                id: booking._id,
                status: booking.status,
                totalPrice: booking.totalPrice
            }
        });

    } catch (error) {
        console.error('[CANCEL BOOKING] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel booking',
            error: error.message
        });
    }
};

/**
 * Approve booking (Owner only) - Atomic transaction with date blocking
 * POST /api/owner/bookings/:id/approve
 */
export const approveBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const ownerId = req.userId; // From auth middleware

        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Verify booking belongs to this owner
        if (booking.ownerId.toString() !== ownerId.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to approve this booking' });
        }

        if (booking.status !== 'pending') {
            return res.status(400).json({ success: false, message: `Cannot approve booking with status: ${booking.status}` });
        }

        // Validate and normalize dates
        let bookingStart, bookingEnd;
        try {
            bookingStart = normalizeDate(booking.startDate);
            bookingEnd = normalizeDate(booking.endDate);
        } catch (dateError) {
            console.error('[APPROVE] Date error:', dateError.message, { start: booking.startDate, end: booking.endDate });
            return res.status(400).json({ success: false, message: `Invalid booking dates: ${dateError.message}` });
        }

        const listingType = booking.propertyId ? 'property' : 'vehicle';
        const listingId = booking.propertyId || booking.vehicleId;

        // Check for date conflicts
        const conflict = await BlockedRange.findOne({
            listingId,
            listingType,
            start: { $lte: bookingEnd },
            end: { $gte: bookingStart }
        }).select('_id bookingId');

        if (conflict) {
            const conflictBooking = await Booking.findById(conflict.bookingId).select('id');
            return res.status(400).json({
                success: false,
                message: `Dates unavailable - conflicts with booking ${conflictBooking?.id || 'unknown'}`
            });
        }

        // Add blocked range
        await BlockedRange.create({
            listingId,
            listingType,
            start: bookingStart,
            end: bookingEnd,
            bookingId: booking._id
        });

        // Update booking status
        booking.status = 'confirmed';
        await booking.save();

        // CRITICAL: Add booking amount to owner's PendingBalance
        const bookingAmount = booking.totalPrice;
        await User.findByIdAndUpdate(booking.ownerId, {
            $inc: { PendingBalance: bookingAmount }
        });

        console.log(`✅ [APPROVED] Booking ${booking._id}: ${bookingStart} → ${bookingEnd}, ₹${bookingAmount} to PendingBalance`);

        res.status(200).json({ success: true, message: 'Booking approved and dates blocked' });
    } catch (error) {
        console.error('❌ [APPROVE ERROR]', error.message);
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * Get blocked dates for a listing
 * GET /api/listings/:id/blocked-dates?type=property
 */
export const getBlockedDates = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, from, to } = req.query;

        const listingType = type === 'vehicle' ? 'vehicle' : 'property';

        const query = { listingId: id, listingType };

        // Optional range filtering
        if (from && to) {
            validateDateFormat(from, 'from');
            validateDateFormat(to, 'to');
            query.start = { $lte: to };
            query.end = { $gte: from };
        }

        const ranges = await BlockedRange.find(query)
            .select('start end bookingId')
            .lean();

        // Cache header (5 seconds for UX responsiveness)
        res.setHeader('Cache-Control', 'public, max-age=5');

        res.status(200).json({
            success: true,
            blockedRanges: ranges,
            blockedDates: ranges.flatMap(r => generateDateArray(r.start, r.end))
        });
    } catch (error) {
        console.error('[BLOCKED DATES ERROR]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Check for overlapping pending bookings (for owner UI warning)
 * POST /api/owner/bookings/:id/check-overlap
 */
export const checkOverlappingPending = async (req, res) => {
    try {
        const { id } = req.params; // bookingId
        const ownerId = req.userId;

        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Verify ownership
        if (booking.ownerId.toString() !== ownerId.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const listingId = booking.propertyId || booking.vehicleId;
        const bookingStart = normalizeDate(booking.startDate);
        const bookingEnd = normalizeDate(booking.endDate);

        // Find other PENDING bookings with overlapping dates
        const overlapping = await Booking.find({
            _id: { $ne: id },
            $or: [
                { propertyId: listingId },
                { vehicleId: listingId }
            ],
            status: 'pending',
            startDate: { $lte: booking.endDate },
            endDate: { $gte: booking.startDate }
        }).select('id startDate endDate userId');

        res.status(200).json({
            success: true,
            hasOverlap: overlapping.length > 0,
            overlappingCount: overlapping.length,
            overlappingBookings: overlapping.map(b => ({
                id: b.id,
                startDate: normalizeDate(b.startDate),
                endDate: normalizeDate(b.endDate)
            }))
        });
    } catch (error) {
        console.error('[OVERLAP CHECK ERROR]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Reject/Decline booking (Owner only)
 * POST /api/owner/bookings/:id/reject
 */
export const rejectBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const ownerId = req.userId; // From auth middleware

        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Verify booking belongs to this owner
        if (booking.ownerId.toString() !== ownerId.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to reject this booking' });
        }

        if (booking.status !== 'pending') {
            return res.status(400).json({ success: false, message: `Cannot reject booking with status: ${booking.status}` });
        }

        // Update booking status to cancelled
        booking.status = 'cancelled';
        await booking.save();

        console.log(`âŒ [REJECTED] Booking ${booking._id} by owner ${ownerId}`);

        res.status(200).json({ success: true, message: 'Booking rejected' });
    } catch (error) {
        console.error('âŒ [REJECT ERROR]', error.message);
        res.status(400).json({ success: false, message: error.message });
    }
};
