import Booking from '../models/booking.js';
import User from '../models/user.js';
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
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const user = await User.findById(userId).select('bookings');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const allBookingIds = [
            ...(user.bookings?.booked || []),
            ...(user.bookings?.inProgress || []),
            ...(user.bookings?.cancelled || [])
        ];

        const bookings = await Booking.find({ _id: { $in: allBookingIds } })
            .populate({ path: 'propertyId', select: 'name images location pricing rentalType', model: Property })
            .populate({ path: 'vehicleId', select: 'name images location price category', model: Vehicle })
            .sort({ createdAt: -1 });

        const categorized = { confirmed: [], completed: [], cancelled: [] };

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

            if (booking.status === 'confirmed') categorized.confirmed.push(bookingData);
            else if (booking.status === 'completed') categorized.completed.push(bookingData);
            else if (booking.status === 'cancelled') categorized.cancelled.push(bookingData);
        });

        res.status(200).json({ success: true, bookings: categorized, total: bookings.length });
    } catch (error) {
        console.error('Error fetching user bookings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch bookings', error: error.message });
    }
};

/**
 * Create test booking
 * POST /api/test/create-booking
 */
export const createTestBooking = async (req, res) => {
    try {
        const {
            userId, ownerId, listingId, listingType,
            startDate, endDate, totalPrice, guests, status
        } = req.body;

        const booking = new Booking({
            userId, ownerId,
            propertyId: listingType === 'property' ? listingId : null,
            vehicleId: listingType === 'vehicle' ? listingId : null,
            startDate, endDate,
            checkIn: startDate, checkOut: endDate,
            totalPrice, guests: guests || 1,
            status: status || 'pending',
            paymentInfo: { method: 'Request', isPaid: false, paidAt: null }
        });

        await User.findByIdAndUpdate(userId, {
            $push: { 'bookings.inProgress': booking._id },
            $inc: { TotalBookings: 1 }
        });

        await booking.save();
        console.log(`[TEST BOOKING] Created ${booking._id} - Status: ${booking.status} (pending balance added on approval only)`);

        res.status(201).json({ success: true, booking: { id: booking._id, status: booking.status, totalPrice: booking.totalPrice } });
    } catch (error) {
        console.error('Error creating test booking:', error);
        res.status(500).json({ success: false, message: 'Failed to create test booking', error: error.message });
    }
};

/**
 * Cancel booking
 * POST /api/user/bookings/cancel
 */
export const cancelBooking = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { bookingId } = req.body;
        const userId = req.userId;

        const booking = await Booking.findById(bookingId).session(session);

        if (!booking) throw new Error('Booking not found');
        if (booking.userId.toString() !== userId.toString()) throw new Error('Not authorized');
        if (booking.status === 'cancelled') throw new Error('Already cancelled');

        const wasConfirmed = booking.status === 'confirmed';

        booking.status = 'cancelled';
        await booking.save({ session });

        if (wasConfirmed) {
            await BlockedRange.deleteOne({ bookingId: booking._id }).session(session);
            const owner = await User.findById(booking.ownerId).session(session);
            const oldBalance = owner.PendingBalance || 0;
            const newBalance = oldBalance - booking.totalPrice;
            owner.PendingBalance = newBalance;
            await owner.save({ session });
            console.log(`[CANCELLED] Unblocked dates, deducted ${booking.totalPrice} from owner wallet`);
        }

        await session.commitTransaction();
        res.status(200).json({ success: true, message: 'Booking cancelled', wasConfirmed });
    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};

/**
 * Approve booking - ADDS money to owner's pending balance
 * POST /api/owner/bookings/:id/approve
 */
export const approveBooking = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const { id } = req.params;
            const ownerId = req.userId;

            const booking = await Booking.findById(id).session(session);

            if (!booking) throw new Error('Booking not found');
            if (booking.ownerId.toString() !== ownerId.toString()) throw new Error('Not authorized');
            if (booking.status !== 'pending') throw new Error(`Cannot approve - current status: ${booking.status}`);

            const bookingStart = validateDateFormat(normalizeDate(booking.startDate), 'Start date');
            const bookingEnd = validateDateFormat(normalizeDate(booking.endDate), 'End date');

            const listingType = booking.propertyId ? 'property' : 'vehicle';
            const listingId = booking.propertyId || booking.vehicleId;

            const conflict = await BlockedRange.findOne({
                listingId, listingType,
                start: { $lte: bookingEnd },
                end: { $gte: bookingStart }
            }).select('_id bookingId').session(session);

            if (conflict) {
                const conflictBooking = await Booking.findById(conflict.bookingId).select('id');
                throw new Error(`Dates unavailable - conflicts with booking ${conflictBooking?.id || 'unknown'}`);
            }

            await BlockedRange.create([{
                listingId, listingType,
                start: bookingStart,
                end: bookingEnd,
                bookingId: booking._id
            }], { session });

            booking.status = 'confirmed';
            await booking.save({ session });

            // WALLET: Add money to owner's pending balance (backend-calculated)
            const bookingAmount = booking.totalPrice;
            await User.findByIdAndUpdate(ownerId, { $inc: { PendingBalance: bookingAmount } }, { session });

            console.log(`✅ [APPROVED] Booking ${booking._id}: ${bookingStart} → ${bookingEnd}`);
            console.log(`💰 [WALLET] Added ₹${bookingAmount} to owner ${ownerId} pending balance`);
        });

        res.status(200).json({ success: true, message: 'Booking approved, dates blocked, payment added to wallet' });
    } catch (error) {
        console.error('❌ [APPROVE ERROR]', error.message);
        res.status(400).json({ success: false, message: error.message });
    } finally {
        session.endSession();
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

        if (from && to) {
            validateDateFormat(from, 'from');
            validateDateFormat(to, 'to');
            query.start = { $lte: to };
            query.end = { $gte: from };
        }

        const ranges = await BlockedRange.find(query).select('start end bookingId').lean();

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
 * Check overlapping pending bookings
 * POST /api/owner/bookings/:id/check-overlap
 */
export const checkOverlappingPending = async (req, res) => {
    try {
        const { id } = req.params;
        const ownerId = req.userId;

        const booking = await Booking.findById(id);

        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
        if (booking.ownerId.toString() !== ownerId.toString()) return res.status(403).json({ success: false, message: 'Not authorized' });

        const listingId = booking.propertyId || booking.vehicleId;

        const overlapping = await Booking.find({
            _id: { $ne: id },
            $or: [{ propertyId: listingId }, { vehicleId: listingId }],
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
 * Reject booking - NO money added (booking was never approved)
 * POST /api/owner/bookings/:id/reject
 */
export const rejectBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const ownerId = req.userId;

        const booking = await Booking.findById(id);

        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
        if (booking.ownerId.toString() !== ownerId.toString()) return res.status(403).json({ success: false, message: 'Not authorized' });
        if (booking.status !== 'pending') return res.status(400).json({ success: false, message: `Cannot reject - status: ${booking.status}` });

        booking.status = 'cancelled';
        await booking.save();

        console.log(`❌ [REJECTED] Booking ${booking._id} - No wallet change (was never approved)`);
        res.status(200).json({ success: true, message: 'Booking rejected' });
    } catch (error) {
        console.error('[REJECT ERROR]', error.message);
        res.status(400).json({ success: false, message: error.message });
    }
};
