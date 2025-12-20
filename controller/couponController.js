// controller/couponController.js
import mongoose from 'mongoose';
import Coupon from '../models/coupon.js';
import CouponAssignment from '../models/couponAssignment.js';
import CouponUsage from '../models/couponUsage.js';
import Booking from '../models/booking.js';
import Notification from '../models/notification.js';

/**
 * GET /api/coupons/available
 * Get all active coupons available to the authenticated user
 */
export const getAvailableCoupons = async (req, res) => {
    try {
        const userId = req.userId; // From authUser middleware
        const coupons = await Coupon.getAvailableForUser(userId);

        // Check which ones user has already claimed
        const claimedCouponIds = await CouponAssignment.find({ userId })
            .distinct('couponId');

        const couponsWithClaimStatus = coupons.map(coupon => ({
            ...coupon.toObject(),
            isClaimed: claimedCouponIds.some(id => id.toString() === coupon._id.toString())
        }));

        res.json({
            success: true,
            coupons: couponsWithClaimStatus
        });
    } catch (error) {
        console.error('Error fetching available coupons:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * GET /api/coupons/my-coupons
 * Get user's claimed coupons with usage status
 */
export const getMyCoupons = async (req, res) => {
    try {
        const userId = req.userId;
        const includeUsed = req.query.includeUsed === 'true';

        const coupons = await CouponAssignment.getUserCoupons(userId, includeUsed);

        res.json({
            success: true,
            coupons: coupons.map(assignment => ({
                ...assignment.couponId.toObject(),
                assignmentId: assignment._id,
                claimedAt: assignment.claimedAt,
                usedCount: assignment.usedCount,
                lastUsedAt: assignment.lastUsedAt,
                remainingUses: (assignment.couponId.maxUsesPerUser || 1) - assignment.usedCount
            }))
        });
    } catch (error) {
        console.error('Error fetching user coupons:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * POST /api/coupons/claim/:code
 * Claim a coupon by code (transaction-safe)
 */
export const claimCoupon = async (req, res) => {
    const userId = req.userId;
    const { code } = req.params;
    const { notificationId } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const now = new Date();

        // Find and validate coupon
        const coupon = await Coupon.findOne({ code: code.toUpperCase() }).session(session);

        if (!coupon) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        if (!coupon.isActive) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: 'Coupon is not active' });
        }

        if (coupon.validFrom && now < coupon.validFrom) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: 'Coupon not active yet' });
        }

        if (coupon.validUntil && now > coupon.validUntil) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: 'Coupon has expired' });
        }

        if (coupon.isExhausted) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: 'Coupon has been fully redeemed' });
        }

        // Check if user is eligible for this coupon
        if (!coupon.isUserEligible(userId)) {
            await session.abortTransaction();
            return res.status(403).json({ success: false, message: 'You are not eligible for this coupon' });
        }

        // Create assignment (unique index prevents duplicates)
        const assignment = await CouponAssignment.create([{
            couponId: coupon._id,
            userId,
            claimedAt: now,
            notificationId
        }], { session });

        // Mark notification as claimed if provided
        if (notificationId) {
            await Notification.updateOne(
                { _id: notificationId, userId },
                {
                    $set: {
                        isRead: true,
                        readAt: now,
                        'data.isClaimed': true,
                        'data.claimedAt': now
                    }
                }
            ).session(session);
        }

        await session.commitTransaction();

        res.json({
            success: true,
            message: 'Coupon claimed successfully',
            coupon: {
                ...coupon.toObject(),
                assignmentId: assignment[0]._id,
                claimedAt: now
            }
        });

    } catch (error) {
        await session.abortTransaction();

        // Handle duplicate claim
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'You have already claimed this coupon'
            });
        }

        console.error('Error claiming coupon:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        session.endSession();
    }
};

/**
 * POST /api/coupons/validate
 * Validate if a coupon can be applied to a booking (without actually applying it)
 */
export const validateCoupon = async (req, res) => {
    try {
        const userId = req.userId;
        const { code, bookingAmount, bookingType } = req.body; // bookingType: 'property' or 'vehicle'

        if (!code || !bookingAmount) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code and booking amount are required'
            });
        }

        const coupon = await Coupon.findOne({ code: code.toUpperCase() });

        if (!coupon || !coupon.isActive) {
            return res.json({
                success: false,
                valid: false,
                message: 'Invalid coupon code'
            });
        }

        const now = new Date();

        // Check validity period
        if (coupon.validFrom && now < coupon.validFrom) {
            return res.json({
                success: false,
                valid: false,
                message: 'Coupon is not active yet'
            });
        }

        if (coupon.validUntil && now > coupon.validUntil) {
            return res.json({
                success: false,
                valid: false,
                message: 'Coupon has expired'
            });
        }

        // Check max uses
        if (coupon.isExhausted) {
            return res.json({
                success: false,
                valid: false,
                message: 'Coupon has been fully redeemed'
            });
        }

        // Check minimum amount
        if (coupon.minBookingAmount && bookingAmount < coupon.minBookingAmount) {
            return res.json({
                success: false,
                valid: false,
                message: `Minimum booking amount ₹${coupon.minBookingAmount} required`
            });
        }

        // Check applicability
        if (bookingType && coupon.applicableFor !== 'both') {
            if (coupon.applicableFor !== bookingType) {
                return res.json({
                    success: false,
                    valid: false,
                    message: `Coupon only applicable for ${coupon.applicableFor} bookings`
                });
            }
        }

        // Check if user is eligible
        if (!coupon.isUserEligible(userId)) {
            return res.json({
                success: false,
                valid: false,
                message: 'You are not eligible for this coupon'
            });
        }

        // Check per-user usage limit
        const userUsageCount = await CouponUsage.countDocuments({
            couponId: coupon._id,
            userId
        });

        if (userUsageCount >= (coupon.maxUsesPerUser || 1)) {
            return res.json({
                success: false,
                valid: false,
                message: 'You have already used this coupon'
            });
        }

        // Calculate discount
        let discountAmount = 0;
        if (coupon.type === 'percentage') {
            discountAmount = Math.floor((bookingAmount * coupon.value) / 100);
            // Apply max discount cap if specified
            if (coupon.maxDiscountAmount) {
                discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
            }
        } else {
            discountAmount = coupon.value;
        }

        // Don't allow discount to exceed booking amount
        discountAmount = Math.min(discountAmount, bookingAmount);

        const finalPrice = bookingAmount - discountAmount;

        res.json({
            success: true,
            valid: true,
            message: 'Coupon is valid',
            discount: {
                type: coupon.type,
                value: coupon.value,
                discountAmount,
                originalPrice: bookingAmount,
                finalPrice,
                savings: discountAmount
            }
        });

    } catch (error) {
        console.error('Error validating coupon:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * POST /api/coupons/apply
 * Apply coupon to a booking (transaction-safe with conditional updates)
 * Body: { bookingId, couponCode }
 */
export const applyCouponToBooking = async (req, res) => {
    const userId = req.userId;
    const { bookingId, couponCode } = req.body;

    if (!bookingId || !couponCode) {
        return res.status(400).json({
            success: false,
            message: 'Booking ID and coupon code are required'
        });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const now = new Date();

        // Find coupon
        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() }).session(session);

        if (!coupon || !coupon.isActive) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: 'Invalid coupon code' });
        }

        // Validate coupon timing
        if (coupon.validFrom && now < coupon.validFrom) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: 'Coupon not active yet' });
        }

        if (coupon.validUntil && now > coupon.validUntil) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: 'Coupon has expired' });
        }

        // Find booking
        const booking = await Booking.findById(bookingId).session(session);

        if (!booking) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // SECURITY: Verify booking ownership
        if (booking.userId.toString() !== userId.toString()) {
            await session.abortTransaction();
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Check if booking already has a coupon
        if (booking.couponId) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: 'Booking already has a coupon applied' });
        }

        const originalPrice = booking.totalPrice;

        // Check minimum amount
        if (coupon.minBookingAmount && originalPrice < coupon.minBookingAmount) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: `Minimum booking amount ₹${coupon.minBookingAmount} required`
            });
        }

        // Check applicability (property vs vehicle)
        const bookingType = booking.propertyId ? 'property' : 'vehicle';
        if (coupon.applicableFor !== 'both' && coupon.applicableFor !== bookingType) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: `Coupon only applicable for ${coupon.applicableFor} bookings`
            });
        }

        // Check if user is eligible
        if (!coupon.isUserEligible(userId)) {
            await session.abortTransaction();
            return res.status(403).json({ success: false, message: 'You are not eligible for this coupon' });
        }

        // Check per-user usage limit
        const userUsageCount = await CouponUsage.countDocuments({
            couponId: coupon._id,
            userId
        }).session(session);

        if (userUsageCount >= (coupon.maxUsesPerUser || 1)) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: 'You have already used this coupon' });
        }

        // CRITICAL: Conditional update to prevent race condition on global usage limit
        if (coupon.maxUses !== null) {
            const updatedCoupon = await Coupon.findOneAndUpdate(
                {
                    _id: coupon._id,
                    usedCount: { $lt: coupon.maxUses } // Only increment if below limit
                },
                { $inc: { usedCount: 1 } },
                { session, new: true }
            );

            if (!updatedCoupon) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: 'Coupon has been fully redeemed' });
            }
        } else {
            // Unlimited uses - just increment
            await Coupon.updateOne(
                { _id: coupon._id },
                { $inc: { usedCount: 1 } }
            ).session(session);
        }

        // Calculate discount
        let discountAmount = 0;
        if (coupon.type === 'percentage') {
            discountAmount = Math.floor((originalPrice * coupon.value) / 100);
            if (coupon.maxDiscountAmount) {
                discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
            }
        } else {
            discountAmount = coupon.value;
        }

        discountAmount = Math.min(discountAmount, originalPrice);
        const finalPrice = originalPrice - discountAmount;

        // Update booking
        booking.originalPrice = originalPrice;
        booking.couponId = coupon._id;
        booking.couponCode = coupon.code;
        booking.discountAmount = discountAmount;
        booking.totalPrice = finalPrice;
        await booking.save({ session });

        // Create usage record (audit trail)
        await CouponUsage.create([{
            userId,
            couponId: coupon._id,
            bookingId: booking._id,
            discountAmount,
            originalPrice,
            finalPrice,
            couponCode: coupon.code,
            usedAt: now
        }], { session });

        // Update assignment usage count if exists
        await CouponAssignment.updateOne(
            { couponId: coupon._id, userId },
            {
                $inc: { usedCount: 1 },
                $set: { lastUsedAt: now }
            }
        ).session(session);

        // Check if coupon is now exhausted and deactivate
        if (coupon.maxUses !== null && coupon.usedCount + 1 >= coupon.maxUses) {
            await Coupon.updateOne(
                { _id: coupon._id },
                { $set: { isActive: false } }
            ).session(session);
        }

        await session.commitTransaction();

        res.json({
            success: true,
            message: 'Coupon applied successfully',
            booking: {
                id: booking._id,
                originalPrice,
                discountAmount,
                finalPrice,
                savings: discountAmount
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error applying coupon:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        session.endSession();
    }
};
