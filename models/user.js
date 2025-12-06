import { Schema, model } from 'mongoose';


const UserSchema = new Schema({
  // Basic identity
  name: { type: String, required: true, index: true },
  email: { type: String, lowercase: true, unique: true, sparse: true, index: true },
  phone: { type: String, unique: true, sparse: true, index: true },
  bio: { type: String },
  kyc: { type: String,enum: ['completed', 'pending', 'UnCompleted'],default:'UnCompleted'},
  // Auth
  password: { type: String, select: false },

  // Profile & KYC
  avatar: String,
  banner: String,


  loginAttempts: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },

  // Favorites - separate arrays for properties and vehicles
  favourites: {
    properties: [{ type: Schema.Types.ObjectId, ref: 'Property' }],
    vehicles: [{ type: Schema.Types.ObjectId, ref: 'Vehicle' }]
  },

  // Recently visited properties (LRU cache, max 20)
  // Controller handles limiting to 20 items via slice
  visitedProperties: {
    type: [{
      propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
      visitedAt: { type: Date, default: Date.now }
    }],
    default: []
  },

  // Recently visited vehicles (LRU cache, max 20)
  visitedVehicles: {
    type: [{
      vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
      visitedAt: { type: Date, default: Date.now }
    }],
    default: []
  },

  // Bookings tracking
  bookings: {
    booked: [{ type: Schema.Types.ObjectId, ref: 'Booking' }],
    inProgress: [{ type: Schema.Types.ObjectId, ref: 'Booking' }],
    cancelled: [{ type: Schema.Types.ObjectId, ref: 'Booking' }]
  },
  ReferralCode: { type: String },

  Achivements: { name: [{ type: String }] },
  Country: { type: String },
  State: { type: String },
  City: { type: String },

}, { timestamps: true });

export default model('User', UserSchema);