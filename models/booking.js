// models/booking.js
import { Schema, model } from 'mongoose';

const BookingSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        propertyId: { type: Schema.Types.ObjectId, ref: 'Property' },
        vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },

        // Pricing with coupon support
        originalPrice: { type: Number }, // Price before discount
        totalPrice: { type: Number, required: true }, // Final price after discount

        // Coupon tracking
        couponId: { type: Schema.Types.ObjectId, ref: 'Coupon' },
        couponCode: { type: String, uppercase: true },
        discountAmount: { type: Number, default: 0, min: 0 },

        status: {
            type: String,
            enum: ['confirmed', 'cancelled', 'completed'],
            default: 'pending'
        },
        paymentStatus: {
            type: String,
            enum: ['paid', 'refunded'],
            default: 'pending'
        },
    },
    { timestamps: true }
);

// Indexes for efficient queries
BookingSchema.index({ userId: 1, status: 1 });
BookingSchema.index({ propertyId: 1, startDate: 1, endDate: 1 });
BookingSchema.index({ vehicleId: 1, startDate: 1, endDate: 1 });

export default model('Booking', BookingSchema);
