// models/propertyReview.js
import { Schema, model } from 'mongoose';

const PropertyReviewSchema = new Schema(
  {
    propertyId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Property', 
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
      cleanliness: { type: Number, min: 1, max: 5 },
      location: { type: Number, min: 1, max: 5 },
      amenities: { type: Number, min: 1, max: 5 },
      valueForMoney: { type: Number, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 }
    },
    
    // Photos (optional)
    images: { type: [String], default: [] },
    
    // Verification
    verified: { type: Boolean, default: false }, // verified booking/stay
    
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

// Compound index to prevent duplicate reviews from same user for same property
PropertyReviewSchema.index({ propertyId: 1, userId: 1 }, { unique: true });

// Index for querying by status
PropertyReviewSchema.index({ status: 1 });

// Pre-save hook to update property rating
PropertyReviewSchema.post('save', async function() {
  const PropertyReview = model('PropertyReview');
  const Property = model('Property');
  
  try {
    const reviews = await PropertyReview.find({ 
      propertyId: this.propertyId, 
      status: 'approved' 
    });
    
    if (reviews.length > 0) {
      const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
      
      await Property.findByIdAndUpdate(this.propertyId, {
        'rating.avg': Math.round(avgRating * 10) / 10, // Round to 1 decimal
        'rating.count': reviews.length
      });
    }
  } catch (error) {
    console.error('Error updating property rating:', error);
  }
});

// Pre-remove hook to update property rating when review is deleted
PropertyReviewSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    const PropertyReview = model('PropertyReview');
    const Property = model('Property');
    
    try {
      const reviews = await PropertyReview.find({ 
        propertyId: doc.propertyId, 
        status: 'approved' 
      });
      
      if (reviews.length > 0) {
        const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
        
        await Property.findByIdAndUpdate(doc.propertyId, {
          'rating.avg': Math.round(avgRating * 10) / 10,
          'rating.count': reviews.length
        });
      } else {
        await Property.findByIdAndUpdate(doc.propertyId, {
          'rating.avg': 0,
          'rating.count': 0
        });
      }
    } catch (error) {
      console.error('Error updating property rating:', error);
    }
  }
});

export default model('PropertyReview', PropertyReviewSchema);
