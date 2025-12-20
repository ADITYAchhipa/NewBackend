// models/couponUsage.js
import { Schema, model } from 'mongoose';

/**
 * CouponUsage - Audit trail for every coupon redemption
 * Used for analytics, reconciliation, and preventing fraud
 */
const CouponUsageSchema = new Schema({
    // References
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    couponId: {
        type: Schema.Types.ObjectId,
        ref: 'Coupon',
        required: true,
        index: true
    },
    bookingId: {
        type: Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
        // Index defined below with unique constraint
    },

    // Discount details (snapshot at time of use)
    discountAmount: {
        type: Number,
        required: true,
        min: 0
    },
    originalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    finalPrice: {
        type: Number,
        required: true,
        min: 0
    },

    // Usage timestamp
    usedAt: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
    },

    // Optional: coupon code snapshot (in case coupon is deleted)
    couponCode: {
        type: String
    }

}, {
    timestamps: false // We use usedAt instead
});

// Indexes for analytics and reconciliation
CouponUsageSchema.index({ couponId: 1, usedAt: -1 });
CouponUsageSchema.index({ userId: 1, usedAt: -1 });
CouponUsageSchema.index({ bookingId: 1 }, { unique: true }); // One coupon per booking

// Static method to get usage stats for a coupon
CouponUsageSchema.statics.getCouponStats = async function (couponId) {
    const stats = await this.aggregate([
        { $match: { couponId } },
        {
            $group: {
                _id: null,
                totalUses: { $sum: 1 },
                totalDiscount: { $sum: '$discountAmount' },
                avgDiscount: { $avg: '$discountAmount' },
                uniqueUsers: { $addToSet: '$userId' }
            }
        }
    ]);

    return stats[0] || {
        totalUses: 0,
        totalDiscount: 0,
        avgDiscount: 0,
        uniqueUsers: []
    };
};

// Static method for reconciliation - check if usedCount matches actual usage
CouponUsageSchema.statics.reconcileCoupon = async function (couponId) {
    const Coupon = this.model('Coupon');
    const actualUses = await this.countDocuments({ couponId });
    const coupon = await Coupon.findById(couponId);

    if (!coupon) return { error: 'Coupon not found' };

    const diff = actualUses - coupon.usedCount;

    if (diff !== 0) {
        // Fix the discrepancy
        await Coupon.updateOne({ _id: couponId }, { usedCount: actualUses });
        return { reconciled: true, difference: diff, actualUses };
    }

    return { reconciled: false, difference: 0, actualUses };
};

export default model('CouponUsage', CouponUsageSchema);
