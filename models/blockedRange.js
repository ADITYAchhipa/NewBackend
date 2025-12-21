import mongoose from 'mongoose';

const blockedRangeSchema = new mongoose.Schema({
    listingId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    listingType: {
        type: String,
        enum: ['property', 'vehicle'],
        required: true
    },
    start: {
        type: String, // YYYY-MM-DD
        required: true,
        validate: {
            validator: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
            message: 'Date must be YYYY-MM-DD format'
        }
    },
    end: {
        type: String, // YYYY-MM-DD (inclusive)
        required: true,
        validate: {
            validator: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
            message: 'Date must be YYYY-MM-DD format'
        }
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index for fast range queries
blockedRangeSchema.index({ listingId: 1, start: 1, end: 1 });

// Prevent duplicate entries for same booking
blockedRangeSchema.index({ bookingId: 1 }, { unique: true });

export default mongoose.model('BlockedRange', blockedRangeSchema);
