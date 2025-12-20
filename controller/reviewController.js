// controller/reviewController.js
import PropertyReview from '../models/propertyReview.js';
import VehicleReview from '../models/vehicleReview.js';
import Property from '../models/property.js';
import Vehicle from '../models/vehicle.js';

// Add a new review (for property or vehicle)
export const addReview = async (req, res) => {
  try {
    const {
      type, // 'property' or 'vehicle'
      itemId, // propertyId or vehicleId
      rating,
      comment,
      detailedRatings,
      images
    } = req.body;

    const userId = req.userId; // from auth middleware

    // Validate required fields
    if (!type || !itemId || !rating || !comment) {
      return res.json({
        success: false,
        message: 'Type, itemId, rating, and comment are required'
      });
    }

    // Validate type
    if (type !== 'property' && type !== 'vehicle') {
      return res.json({
        success: false,
        message: 'Type must be either "property" or "vehicle"'
      });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Check if item exists
    if (type === 'property') {
      const property = await Property.findById(itemId);
      if (!property) {
        return res.json({ success: false, message: 'Property not found' });
      }

      // Check if user already reviewed this property
      const existingReview = await PropertyReview.findOne({
        propertyId: itemId,
        userId
      });

      if (existingReview) {
        return res.json({
          success: false,
          message: 'You have already reviewed this property'
        });
      }

      // Create new property review
      const newReview = new PropertyReview({
        propertyId: itemId,
        userId,
        rating,
        comment,
        detailedRatings,
        images: images || [],
        status: 'approved' // Auto-approve or set to 'pending' if you want manual approval
      });

      await newReview.save();

      return res.json({
        success: true,
        message: 'Property review added successfully',
        review: newReview
      });

    } else {
      // Vehicle review
      const vehicle = await Vehicle.findById(itemId);
      if (!vehicle) {
        return res.json({ success: false, message: 'Vehicle not found' });
      }

      // Check if user already reviewed this vehicle
      const existingReview = await VehicleReview.findOne({
        vehicleId: itemId,
        userId
      });

      if (existingReview) {
        return res.json({
          success: false,
          message: 'You have already reviewed this vehicle'
        });
      }

      // Create new vehicle review
      const newReview = new VehicleReview({
        vehicleId: itemId,
        userId,
        rating,
        comment,
        detailedRatings,
        images: images || [],
        status: 'approved' // Auto-approve or set to 'pending' if you want manual approval
      });

      await newReview.save();

      return res.json({
        success: true,
        message: 'Vehicle review added successfully',
        review: newReview
      });
    }

  } catch (error) {
    console.error('Error adding review:', error);
    res.json({ success: false, message: error.message });
  }
};

// Get all reviews for a specific property
export const getPropertyReviews = async (req, res) => {
  try {
    const { propertyId } = req.params;

    if (!propertyId) {
      return res.json({ success: false, message: 'Property ID is required' });
    }

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.json({ success: false, message: 'Property not found' });
    }

    // Get all approved reviews for this property
    const reviews = await PropertyReview.find({
      propertyId,
      status: 'approved'
    })
      .populate('userId', 'name avatar') // Populate user info
      .sort({ createdAt: -1 }); // Most recent first

    return res.json({
      success: true,
      reviews,
      count: reviews.length,
      averageRating: property.rating.avg
    });

  } catch (error) {
    console.error('Error fetching property reviews:', error);
    res.json({ success: false, message: error.message });
  }
};

// Get all reviews for a specific vehicle
export const getVehicleReviews = async (req, res) => {
  try {
    const { vehicleId } = req.params;

    if (!vehicleId) {
      return res.json({ success: false, message: 'Vehicle ID is required' });
    }

    // Check if vehicle exists
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.json({ success: false, message: 'Vehicle not found' });
    }

    // Get all approved reviews for this vehicle
    const reviews = await VehicleReview.find({
      vehicleId,
      status: 'approved'
    })
      .populate('userId', 'name avatar') // Populate user info
      .sort({ createdAt: -1 }); // Most recent first

    return res.json({
      success: true,
      reviews,
      count: reviews.length,
      averageRating: vehicle.rating.avg
    });

  } catch (error) {
    console.error('Error fetching vehicle reviews:', error);
    res.json({ success: false, message: error.message });
  }
};

// Update a review
export const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment, detailedRatings, images } = req.body;
    const userId = req.userId; // From authUser middleware

    // SECURITY: Ownership check - only owner can update their review
    let review = await PropertyReview.findOne({ _id: reviewId, userId: userId });
    let type = 'property';

    if (!review) {
      review = await VehicleReview.findOne({ _id: reviewId, userId: userId });
      type = 'vehicle';
    }

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found' // Generic message prevents enumeration
      });
    }

    // Update fields
    if (rating !== undefined) review.rating = rating;
    if (comment !== undefined) review.comment = comment;
    if (detailedRatings) review.detailedRatings = detailedRatings;
    if (images) review.images = images;

    await review.save();

    return res.json({
      success: true,
      message: 'Review updated successfully',
      review
    });

  } catch (error) {
    console.error('Error updating review:', error);
    res.json({ success: false, message: error.message });
  }
};

// Delete a review
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.userId;

    // Try to find in both collections
    let review = await PropertyReview.findById(reviewId);
    let Model = PropertyReview;

    if (!review) {
      review = await VehicleReview.findById(reviewId);
      Model = VehicleReview;
    }

    if (!review) {
      return res.json({ success: false, message: 'Review not found' });
    }

    // Check if user owns this review
    if (review.userId.toString() !== userId) {
      return res.json({
        success: false,
        message: 'You are not authorized to delete this review'
      });
    }

    await Model.findByIdAndDelete(reviewId);

    return res.json({
      success: true,
      message: 'Review deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting review:', error);
    res.json({ success: false, message: error.message });
  }
};

// Get user's own reviews
export const getUserReviews = async (req, res) => {
  try {
    const userId = req.userId;

    const propertyReviews = await PropertyReview.find({ userId })
      .populate('propertyId', 'title images')
      .sort({ createdAt: -1 });

    const vehicleReviews = await VehicleReview.find({ userId })
      .populate('vehicleId', 'make model photos')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      propertyReviews,
      vehicleReviews,
      totalReviews: propertyReviews.length + vehicleReviews.length
    });

  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.json({ success: false, message: error.message });
  }
};
