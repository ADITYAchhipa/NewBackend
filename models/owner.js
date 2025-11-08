import { Schema, model } from 'mongoose';

const OwnerSchema = new Schema({
  // Basic identity
  name: { type: String, required: true, index: true },
  email: { type: String, lowercase: true, unique: true, sparse: true, index: true },
  phone: { type: String, unique: true, sparse: true, index: true },

  // Auth
  password: { type: String, select: false },

  // Profile & KYC
  avatar: String,
  bio: String,
  kycStatus: { type: String, enum: ['not_provided','pending','verified','rejected'], default: 'not_provided' },
  kycDocs: {
    idProof: String,
    addressProof: String,
    others: [String],
  },

  // payout / contact preferences


  // metadata
  listingsCount: { type: Number, default: 0 },
  rating: { avg: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
  lastActiveAt: Date,

  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

export default model('Owner', OwnerSchema);