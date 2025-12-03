import { Schema, model } from 'mongoose';


const UserSchema = new Schema({
  // Basic identity
  name: { type: String, required: true, index: true },
  email: { type: String, lowercase: true, unique: true, sparse: true, index: true },
  phone: { type: String, unique: true, sparse: true, index: true },
  bio: { type: String },
  // Auth
  password: { type: String, select: false },

  // Profile & KYC
  avatar: String,
  banner: String,
  bio: String,

  loginAttempts: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },

  // Favorites - separate arrays for properties and vehicles
  favourites: {
    properties: [{ type: Schema.Types.ObjectId, ref: 'Property' }],
    vehicles: [{ type: Schema.Types.ObjectId, ref: 'Vehicle' }]
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