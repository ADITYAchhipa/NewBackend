// models/coupon.js
import { Schema, model } from 'mongoose';

const CouponSchema = new Schema({
    // Coupon code - unique, uppercase
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        index: true,
        minlength: 3,
        maxlength: 20
    },

    // Discount configuration
    type: {
        type: String,
        required: true,
        enum: ['percentage', 'fixed']
    },
    value: {
        type: Number,
        required: true,
        min: 0
    },

    // For percentage discounts - cap maximum discount amount
    maxDiscountAmount: {
        type: Number,
        min: 0
    },

    // Visibility & targeting
    visibility: {
        type: String,
        enum: ['public', 'targeted', 'referral', 'auto'],
        default: 'public',
        index: true
    },

    // Validity period
    validFrom: {
        type: Date,
        default: Date.now
    },
    validUntil: {
        type: Date,
        required: true,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },

    // Usage limits
    maxUses: {
        type: Number,
        min: 0,
        default: null // null = unlimited
    },
    usedCount: {
        type: Number,
        default: 0,
        min: 0
    },
    maxUsesPerUser: {
        type: Number,
        default: 1,
        min: 1
    },

    // Applicability rules
    applicableFor: {
        type: String,
        enum: ['property', 'vehicle', 'both'],
        default: 'both'
    },
    minBookingAmount: {
        type: Number,
        default: 0,
        min: 0
    },

    // Targeting - specific users or items
    specificUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    specificItems: [{
        type: Schema.Types.ObjectId
        // Can reference Property or Vehicle
    }],

    // Metadata
    description: {
        type: String,
        maxlength: 500
    },
    category: {
        type: String,
        enum: ['welcome', 'seasonal', 'loyalty', 'referral', 'special'],
        default: 'special'
    },

    // Admin tracking (from separate admin portal)
    createdByAdmin: {
        type: String
    }

}, {
    timestamps: true
});

// Indexes for efficient queries
CouponSchema.index({ isActive: 1, validUntil: 1 });
CouponSchema.index({ visibility: 1, isActive: 1 });
CouponSchema.index({ specificUsers: 1 }, { sparse: true });

// Virtual to check if coupon is expired
CouponSchema.virtual('isExpired').get(function () {
    const now = new Date();
    return (this.validUntil && this.validUntil < now) ||
        (this.validFrom && this.validFrom > now);
});

// Virtual to check if coupon is exhausted
CouponSchema.virtual('isExhausted').get(function () {
    return this.maxUses !== null && this.usedCount >= this.maxUses;
});

// Method to check if user is eligible
CouponSchema.methods.isUserEligible = function (userId) {
    // Public coupons are available to everyone
    if (this.visibility === 'public') return true;

    // Targeted coupons only for specific users
    if (this.visibility === 'targeted' && this.specificUsers && this.specificUsers.length > 0) {
        return this.specificUsers.some(id => id.toString() === userId.toString());
    }

    return true;
};

// Static method to get available coupons for a user
CouponSchema.statics.getAvailableForUser = async function (userId) {
    const now = new Date();
    return this.find({
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
        $or: [
            { visibility: 'public' },
            { visibility: 'targeted', specificUsers: userId }
        ]
    }).sort({ createdAt: -1 });
};

/**
 * Post-save hook: Send notifications to targeted users when coupon is created
 * Only runs for new documents with visibility='targeted' and specificUsers
 */
CouponSchema.post('save', async function (doc) {
    // Only send notifications for new targeted coupons
    if (!doc.wasNew) return;
    if (doc.visibility !== 'targeted') return;
    if (!doc.specificUsers || doc.specificUsers.length === 0) return;

    try {
        // Dynamically import Notification to avoid circular dependency
        const Notification = (await import('./notification.js')).default;

        const notifications = doc.specificUsers.map(userId => ({
            userId,
            title: '🎁 Special Coupon for You!',
            message: doc.description || `Use code ${doc.code} to get ${doc.type === 'percentage' ? `${doc.value}% off` : `₹${doc.value} off`} on your next booking!`,
            type: 'coupon',
            priority: 'high',
            data: {
                couponId: doc._id,
                couponCode: doc.code,
                discountType: doc.type,
                discountValue: doc.value,
                maxDiscount: doc.maxDiscountAmount,
                validUntil: doc.validUntil,
                applicableFor: doc.applicableFor,
                minBookingAmount: doc.minBookingAmount,
                isClaimed: false
            },
            actionUrl: `/coupons/claim/${doc.code}`,
            expiresAt: doc.validUntil
        }));

        await Notification.insertMany(notifications);
        console.log(`📧 [Coupon] Sent ${notifications.length} coupon notifications for code: ${doc.code}`);
    } catch (error) {
        console.error('❌ [Coupon] Error sending coupon notifications:', error.message);
        // Don't throw - coupon was created successfully, notification failure is non-critical
    }
});

// Track if document is new (for post-save hook)
CouponSchema.pre('save', function (next) {
    this.wasNew = this.isNew;
    next();
});

export default model('Coupon', CouponSchema);
