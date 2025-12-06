import { Schema, model } from 'mongoose';

const KycSchema = new Schema({
    // Reference to User
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },

    // Personal information
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dob: { type: String, required: true }, // Date of birth as string (DD/MM/YYYY format)
    address: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },

    // Document information
    documentType: {
        type: String,
        enum: ['passport', 'drivers_license', 'national_id'],
        required: true
    },

    // Cloudinary image URLs
    frontIdUrl: { type: String, required: true },
    backIdUrl: { type: String }, // Not required for passport
    selfieUrl: { type: String, required: true },

    // Verification status
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
        index: true
    },

    // Rejection reason (only if rejected)
    rejectionReason: { type: String },

    // Timestamps
    submittedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date }

}, { timestamps: true });

// Prevent model recompilation error in development
export default model.models?.Kyc || model('Kyc', KycSchema);
