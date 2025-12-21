import { Schema, model } from 'mongoose';


const UserSchema = new Schema({
  // Basic identity
  name: { type: String, required: true, index: true },
  email: { type: String, lowercase: true, unique: true, sparse: true, index: true },
  phone: { type: String, unique: true, sparse: true, index: true },
  bio: { type: String },
  kyc: { type: String, enum: ['completed', 'pending', 'UnCompleted'], default: 'UnCompleted' },
  // Auth
  password: { type: String, select: false },
  TotalEarnings: { type: Number, default: 0 },
  ActiveListings: { type: Number, default: 0 },
  InactiveListings: { type: Number, default: 0 },
  TotalBookings: { type: Number, default: 0 },
  AvailableBalance: { type: Number, default: 0 },
  PendingBalance: { type: Number, default: 0 }, // Pending earnings from bookings awaiting completion

  // Separate counts for properties and vehicles
  TotalPropertyListings: { type: Number, default: 0 },
  TotalVehicleListings: { type: Number, default: 0 },

  // Profile & KYC
  avatar: String,
  banner: String,

  // Admin flag for platform administrators (manually set in DB)
  isAdmin: { type: Boolean, default: false },


  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date }, // Account lock expiration time
  lastPasswordResetToken: { type: String }, // Prevent password reset token replay
  tokenVersion: { type: Number, default: 0 }, // JWT invalidation on password change/logout-all
  reviews: { type: Number, default: 0 },

  // Favorites - separate arrays for properties and vehicles
  favourites: {
    properties: [{ type: Schema.Types.ObjectId, ref: 'Property' }],
    vehicles: [{ type: Schema.Types.ObjectId, ref: 'Vehicle' }]
  },
  verify: { type: Boolean, default: false },

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

  // Chat - list of users this person has messaged
  propertyOwners: [{ type: Schema.Types.ObjectId, ref: 'User' }],

  Achivements: { name: [{ type: String }] },
  Country: { type: String },
  State: { type: String },
  City: { type: String },

  // Earnings History - for analytics charts
  // daily: 30-item FIFO queue, monthly: 12-item FIFO queue, yearly: dynamic array
  earningsHistory: {
    properties: {
      daily: {
        data: { type: [Number], default: () => Array(30).fill(0) },  // 30 days of earnings
        lastUpdated: {
          day: { type: Number },    // 1-31
          month: { type: Number },  // 1-12
          year: { type: Number }    // e.g., 2024
        }
      },
      monthly: {
        data: { type: [Number], default: () => Array(12).fill(0) },  // 12 months of earnings
        lastUpdated: {
          month: { type: Number },  // 1-12
          year: { type: Number }    // e.g., 2024
        }
      },
      yearly: [{
        year: { type: Number },
        earnings: { type: Number, default: 0 }
      }]
    },
    vehicles: {
      daily: {
        data: { type: [Number], default: () => Array(30).fill(0) },
        lastUpdated: {
          day: { type: Number },
          month: { type: Number },
          year: { type: Number }
        }
      },
      monthly: {
        data: { type: [Number], default: () => Array(12).fill(0) },
        lastUpdated: {
          month: { type: Number },
          year: { type: Number }
        }
      },
      yearly: [{
        year: { type: Number },
        earnings: { type: Number, default: 0 }
      }]
    }
  },

}, { timestamps: true });

// ============================================================================
// SECURITY: Global Data Protection (Defense in Depth)
// ============================================================================
// Prevents sensitive field leakage even if .select() is forgotten
// Works with res.json(), .lean() queries, and logging

function removeSensitive(doc, ret) {
  delete ret.password;
  delete ret.loginAttempts;
  delete ret.lockUntil;
  delete ret.tokenVersion;
  delete ret.lastPasswordResetToken;
  delete ret.resetPasswordExpires;
  delete ret.__v;
  return ret;
}

UserSchema.set('toJSON', { transform: removeSensitive });
UserSchema.set('toObject', { transform: removeSensitive });

export default model('User', UserSchema);