// routes/reviewRoutes.js
import express from 'express';
import { 
  addReview, 
  getPropertyReviews, 
  getVehicleReviews,
  updateReview,
  deleteReview,
  getUserReviews
} from '../controller/reviewController.js';
import authUser from '../middleware/authUser.js';

const reviewRouter = express.Router();

console.log("Review Routes Loaded");

// Add a new review (requires authentication)
reviewRouter.post('/', authUser, addReview);

// Get all reviews for a specific property
reviewRouter.get('/property/:propertyId', getPropertyReviews);

// Get all reviews for a specific vehicle
reviewRouter.get('/vehicle/:vehicleId', getVehicleReviews);

// Get user's own reviews (requires authentication)
reviewRouter.get('/my-reviews', authUser, getUserReviews);

// Update a review (requires authentication)
reviewRouter.put('/:reviewId', authUser, updateReview);

// Delete a review (requires authentication)
reviewRouter.delete('/:reviewId', authUser, deleteReview);

export default reviewRouter;
