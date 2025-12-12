import { Schema, model } from 'mongoose';

/**
 * PendingRegistration Model
 * Temporarily stores user registration data until OTP verification is complete.
 * Auto-deletes after 10 minutes via TTL index.
 */
const PendingRegistrationSchema = new Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        unique: true,
        index: true
    },
    phone: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    hashedPassword: {
        type: String,
        required: true
    },

    // OTP fields
    otpHash: {
        type: String,
        required: true
    },
    otpExpiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    },

    // Security fields
    attempts: {
        type: Number,
        default: 0,
        max: 5
    },
    fingerprint: {
        type: String
    },
    ipAddress: {
        type: String
    },

    // Reference code (optional)
    referralCode: {
        type: String
    },

    createdAt: {
        type: Date,
        default: Date.now,
        expires: 600 // TTL: Auto-delete after 10 minutes
    }
});

// Prevent model recompilation in development (hot reload)
export default global.PendingRegistration ||
    (global.PendingRegistration = model('PendingRegistration', PendingRegistrationSchema));
