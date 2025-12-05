// models/vehicle.js
import mongoose, { Schema, model } from 'mongoose';

const VehicleSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    make: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    vehicleType: { type: String, enum: ['car', 'bike', 'van', 'scooter'], required: true },
    fuelType: { type: String, enum: ['petrol', 'diesel', 'electric', 'hybrid'] },
    transmission: { type: String, enum: ['manual', 'automatic'] },
    seats: Number,
    color: String,
    mileage: Number,
    price: {
      perHour: Number,
      perDay: Number,
      currency: { type: String, default: 'INR' },
      securityDeposit: { type: Number, default: 0 },
    },
    Featured: { type: Boolean, default: false },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] }, // [lng, lat]
      address: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
    photos: { type: [String], default: [] },
    rating: { avg: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
    status: { type: String, enum: ['active', 'inactive', 'suspended', 'deleted'], default: 'active' },
    available: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Text index for quick search
VehicleSchema.index({ make: 'text', model: 'text' });

// 2dsphere index for geospatial queries
VehicleSchema.index({ location: '2dsphere' });

// Use existing model if already compiled, otherwise create new one
export default mongoose.models.Vehicle || model('Vehicle', VehicleSchema);
