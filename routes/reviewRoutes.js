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
import {
  preventNoSQLInjection,
  sanitizeRequest,
  validateReview,
  validateReviewUpdate
} from '../middleware/inputValidator.js';

const reviewRouter = express.Router();

console.log("Review Routes Loaded");

// Apply security middleware to all routes
reviewRouter.use(preventNoSQLInjection);
reviewRouter.use(sanitizeRequest);

// Add a new review (requires authentication + validation)
reviewRouter.post('/', authUser, validateReview, addReview);

// Get all reviews for a specific property
reviewRouter.get('/property/:propertyId', getPropertyReviews);

// Get all reviews for a specific vehicle
reviewRouter.get('/vehicle/:vehicleId', getVehicleReviews);

// Get user's own reviews (requires authentication)
reviewRouter.get('/my-reviews', authUser, getUserReviews);

// Update a review (requires authentication + validation)
reviewRouter.put('/:reviewId', authUser, validateReviewUpdate, updateReview);

// Delete a review (requires authentication)
reviewRouter.delete('/:reviewId', authUser, deleteReview);

export default reviewRouter;
