// models/property.model.js
// import Property from "./models/property.js";
import mongoose from 'mongoose';
import {Schema,model} from 'mongoose'
const PropertySchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Basic listing info
    title: { type: String, required: true, index: true },
    description: { type: String },
    category: {
      type: String,
      enum: ['apartment', 'house', 'villa', 'condo', 'studio', 'pg', 'guest_house', 'land', 'office', 'shared_room'],
      required: true,
      index: true,
    },

    // Price info
    price: {
      perMonth: { type: Number },
      perDay: { type: Number },
      currency: { type: String, default: 'INR' },
      securityDeposit: { type: Number, default: 0 },
    },

    // location: human readable + geo for queries
    address: { type: String },
    city: { type: String, index: true },
    state: { type: String },
    country: { type: String, default: 'India' },
    postalCode: { type: String },

    // GeoJSON for $near queries
    locationGeo: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] }, // [lng, lat]
    },

    // Photos & media
    images: { type: [String], default: [] }, // urls

    // common attributes
    bedrooms: { type: Number },
    bathrooms: { type: Number },
    areaSqft: { type: Number },
    furnished: { type: String, enum: ['unfurnished', 'semi-furnished', 'furnished'], default: 'unfurnished' },
    amenities: { type: [String], default: [] }, // e.g., ['parking','lift','powerBackup','swimmingPool']

    // House-specific details (used when category === 'house')
    houseDetails: {
      houseType: {
        type: String,
        enum: ['1BHK', '2BHK', '3BHK', '4BHK', '5BHK', 'studio', 'duplex', 'penthouse', 'villa', 'shared'],
      },
      separateWashroom: { type: Boolean }, // whether each bedroom has separate washroom
      floor: { type: Number }, // current floor
      totalFloors: { type: Number }, // total floors in building
      plotSizeSqft: { type: Number }, // optional for standalone houses
    },

    // listing state & meta
    status: { type: String, enum: ['active', 'inactive', 'suspended', 'deleted'], default: 'active' },
    available: { type: Boolean, default: true },
    Featured: { type: Boolean, default: false},
    bookingType: { type: String, enum: ['rent', 'sale', 'lease'], default: 'rent' },

    rating: { avg: { type: Number, default: 0 }, count: { type: Number, default: 0 } },

    rules: { type: [String], default: [] }, // e.g., ['noSmoking','noPets']
    meta: {
      views: { type: Number, default: 0 },
      bookings: { type: Number, default: 0 },
      tags: [String],
    },
  },
  { timestamps: true }
);

// Text index for quick search
PropertySchema.index({ title: 'text', description: 'text', city: 'text', 'meta.tags': 'text' });

// 2dsphere index for geospatial queries (must be on the GeoJSON field, not coordinates)
PropertySchema.index({ locationGeo: '2dsphere' });

// Basic validation: require houseDetails.houseType when category === 'house'
PropertySchema.pre('validate', function (next) {
  if (this.category === 'house') {
    if (!this.houseDetails || !this.houseDetails.houseType) {
      return next(new Error('houseDetails.houseType is required when category is "house" (e.g., 2BHK, 3BHK).'));
    }
  }
  next();
});

export default model('Property', PropertySchema);
