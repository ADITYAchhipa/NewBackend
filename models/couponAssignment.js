// models/couponAssignment.js
import { Schema, model } from 'mongoose';

/**
 * CouponAssignment - Tracks which users have claimed which coupons
 * This is the source of truth for "user owns coupon"
 */
const CouponAssignmentSchema = new Schema({
    // References
    couponId: {
        type: Schema.Types.ObjectId,
        ref: 'Coupon',
        required: true,
        index: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Claim tracking
    claimedAt: {
        type: Date,
        default: Date.now,
        required: true
    },

    // Usage tracking for this user
    usedCount: {
        type: Number,
        default: 0,
        min: 0
    },
    lastUsedAt: {
        type: Date
    },

    // Optional: notification that triggered this claim
    notificationId: {
        type: Schema.Types.ObjectId,
        ref: 'Notification'
    }

}, {
    timestamps: true
});

// CRITICAL: Unique index to prevent duplicate claims
// This prevents race conditions when multiple requests try to claim same coupon
CouponAssignmentSchema.index({ couponId: 1, userId: 1 }, { unique: true });

// Compound index for efficient queries
CouponAssignmentSchema.index({ userId: 1, claimedAt: -1 });

// Method to check if user can still use this coupon
CouponAssignmentSchema.methods.canUse = async function () {
    const coupon = await this.model('Coupon').findById(this.couponId);
    if (!coupon) return false;
    if (!coupon.isActive) return false;
    if (coupon.isExpired) return false;
    if (coupon.isExhausted) return false;
    if (this.usedCount >= (coupon.maxUsesPerUser || 1)) return false;
    return true;
};

// Static method to get user's claimed coupons with coupon details
CouponAssignmentSchema.statics.getUserCoupons = async function (userId, includeUsed = false) {
    const query = { userId };

    const assignments = await this.find(query)
        .populate('couponId')
        .sort({ claimedAt: -1 });

    // Filter out expired/inactive coupons and optionally fully used ones
    return assignments.filter(assignment => {
        if (!assignment.couponId) return false;
        const coupon = assignment.couponId;
        if (!coupon.isActive) return false;
        if (coupon.isExpired) return false;
        if (!includeUsed && assignment.usedCount >= (coupon.maxUsesPerUser || 1)) return false;
        return true;
    });
};

export default model('CouponAssignment', CouponAssignmentSchema);
