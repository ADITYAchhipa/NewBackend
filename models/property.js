// models/property.model.js
// import Property from "./models/property.js";
import mongoose from 'mongoose';
import { Schema, model } from 'mongoose'
const PropertySchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Category type: residential, commercial, venue
    categoryType: {
      type: String,
      enum: ['residential', 'commercial', 'venue'],
      default: 'residential',
      index: true,
    },

    // Basic listing info
    title: { type: String, required: true, index: true },   // ok
    description: { type: String },// ok
    category: {
      type: String,
      enum: [
        // Residential
        'apartment', 'house', 'villa', 'studio', 'townhouse', 'condo', 'room', 'pg', 'hostel', 'duplex', 'penthouse', 'bungalow', 'guest_house',
        // Commercial  
        'office', 'shop', 'warehouse', 'coworking', 'showroom', 'clinic', 'restaurant', 'cafe',
        // Venue
        'banquet_hall', 'wedding_venue', 'party_hall', 'conference_room', 'meeting_room', 'auditorium', 'theater', 'garden', 'rooftop', 'ballroom', 'resort', 'farmhouse', 'studio_venue', 'exhibition', 'club', 'dining_room'
      ],
      required: true,
      index: true,
    },// ok

    // Price info
    price: {
      perMonth: { type: Number },
      perDay: { type: Number },
      currency: { type: String, default: 'INR' },
      securityDeposit: { type: Number, default: 0 },
      extraCharges: { type: [String], default: [] },
    },

    // location: human readable + geo for queries
    address: { type: String },
    city: { type: String, index: true },
    state: { type: String },
    country: { type: String, default: 'India' },
    postalCode: { type: String },

    // GeoJSON for $near queries - only set when valid coordinates exist
    locationGeo: {
      type: { type: String, enum: ['Point'] }, // No default - only set when coordinates are valid
      coordinates: { type: [Number] }, // [lng, lat]
    },

    // Photos & media
    images: { type: [String], default: [] }, // urls

    // common attributes
    bedrooms: { type: Number },
    bathrooms: { type: Number },
    areaSqft: { type: Number },
    furnished: { type: String, enum: ['unfurnished', 'semi-furnished', 'furnished'], default: 'unfurnished' },// ok
    amenities: { type: [String], default: [] }, // e.g., ['parking','lift','powerBackup','swimmingPool']

    // Essential amenities for filtering
    essentialAmenities: {
      type: [String],
      default: [],
      // e.g., ['wifi', 'parking', 'ac', 'gym', 'swimming_pool', 'power_backup', 'lift', 'security', 'garden']
    },

    nearbyFacilities: { type: [String], default: [] }, // e.g., ['market', 'hospital', 'school', 'bank', 'supermarket', 'park']
    prefrences: { type: [String], default: [] }, // e.g., ['non-smoking', 'non-pet', 'non-smoking', 'non-pet', 'non-smoking', 'non-pet']

    // House-specific details (used when category === 'house')
    houseDetails: {
      houseType: {
        type: String,
        enum: ['1BHK', '2BHK', '3BHK', '4BHK', '5BHK', 'studio', 'duplex', 'penthouse', 'villa', 'shared'],
      },// ok
      separateWashroom: { type: Boolean }, // whether each bedroom has separate washroom
      floor: { type: Number }, // current floor
      totalFloors: { type: Number }, // total floors in building
      plotSizeSqft: { type: Number }, // optional for standalone houses
    },// ok

    // listing state & meta
    status: { type: String, enum: ['active', 'inactive', 'suspended', 'deleted'], default: 'active' },
    available: { type: Boolean, default: true },
    Featured: { type: Boolean, default: false },
    bookingType: { type: String, enum: ['rent', 'sale', 'lease'], default: 'rent' },

    rating: { avg: { type: Number, default: 0 }, count: { type: Number, default: 0 } },

    rules: { type: [String], default: [] }, // e.g., ['noSmoking','noPets']
    meta: {
      views: { type: Number, default: 0 },
      bookings: { type: Number, default: 0 },
      tags: [String],
    },

    gateClosingTime: { type: String },
    lastDeactivatedAt: { type: Date }, // Track when listing was deactivated for cooldown enforcement

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
