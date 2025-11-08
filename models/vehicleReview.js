// models/vehicleReview.js
import { Schema, model } from 'mongoose';

const VehicleReviewSchema = new Schema(
  {
    vehicleId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Vehicle', 
      required: true, 
      index: true 
    },
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true, 
      index: true 
    },
    
    // Rating (1-5 stars)
    rating: { 
      type: Number, 
      required: true, 
      min: 1, 
      max: 5 
    },
    
    // Review text
    comment: { 
      type: String, 
      required: true,
      minlength: 10,
      maxlength: 1000
    },
    
    // Detailed ratings (optional)
    detailedRatings: {
      condition: { type: Number, min: 1, max: 5 },
      performance: { type: Number, min: 1, max: 5 },
      comfort: { type: Number, min: 1, max: 5 },
      valueForMoney: { type: Number, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 }
    },
    
    // Photos (optional)
    images: { type: [String], default: [] },
    
    // Verification
    verified: { type: Boolean, default: false }, // verified booking/rental
    
    // Status
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected', 'flagged'], 
      default: 'pending' 
    },
    
    // Helpful votes
    helpful: { type: Number, default: 0 },
    
    // Owner response
    ownerResponse: {
      comment: String,
      respondedAt: Date
    }
  },
  { timestamps: true }
);

// Compound index to prevent duplicate reviews from same user for same vehicle
VehicleReviewSchema.index({ vehicleId: 1, userId: 1 }, { unique: true });

// Index for querying by status
VehicleReviewSchema.index({ status: 1 });

// Pre-save hook to update vehicle rating
VehicleReviewSchema.post('save', async function() {
  const VehicleReview = model('VehicleReview');
  const Vehicle = model('Vehicle');
  
  try {
    const reviews = await VehicleReview.find({ 
      vehicleId: this.vehicleId, 
      status: 'approved' 
    });
    
    if (reviews.length > 0) {
      const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
      
      await Vehicle.findByIdAndUpdate(this.vehicleId, {
        'rating.avg': Math.round(avgRating * 10) / 10, // Round to 1 decimal
        'rating.count': reviews.length
      });
    }
  } catch (error) {
    console.error('Error updating vehicle rating:', error);
  }
});

// Pre-remove hook to update vehicle rating when review is deleted
VehicleReviewSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    const VehicleReview = model('VehicleReview');
    const Vehicle = model('Vehicle');
    
    try {
      const reviews = await VehicleReview.find({ 
        vehicleId: doc.vehicleId, 
        status: 'approved' 
      });
      
      if (reviews.length > 0) {
        const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
        
        await Vehicle.findByIdAndUpdate(doc.vehicleId, {
          'rating.avg': Math.round(avgRating * 10) / 10,
          'rating.count': reviews.length
        });
      } else {
        await Vehicle.findByIdAndUpdate(doc.vehicleId, {
          'rating.avg': 0,
          'rating.count': 0
        });
      }
    } catch (error) {
      console.error('Error updating vehicle rating:', error);
    }
  }
});

export default model('VehicleReview', VehicleReviewSchema);
