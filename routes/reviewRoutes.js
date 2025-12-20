
// routes/reviewRoutes.js
import { Router } from 'express';
import {
  addReview,
  getPropertyReviews,
  getVehicleReviews,
  updateReview,
  deleteReview,
  getUserReviews // Keep getUserReviews as it's used in a route that is not removed
} from '../controller/reviewController.js';
import authUser from '../middleware/authUser.js';
import {
  preventNoSQLInjection, // Keep this import as reviewRouter.use(preventNoSQLInjection) is still present in the original
  sanitizeRequest, // Keep this import as reviewRouter.use(sanitizeRequest) is still present in the original
  validateReview,
  validateReviewUpdate // Keep this import as it's used in the original put route, and the instruction changes it to validateReview
} from '../middleware/inputValidator.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { csrfProtect } from '../middleware/csrfProtection.js';
import { reviewLimiter } from '../middleware/advancedRateLimiter.js';

const reviewRouter = Router();

console.log("Review Routes Loaded");

// Apply security middleware to all routes
reviewRouter.use(preventNoSQLInjection);
reviewRouter.use(sanitizeRequest);

// Add a new review (requires authentication + validation)
reviewRouter.post('/', authUser, csrfProtect, reviewLimiter, validateReview, addReview);

// Get all reviews for a specific property
reviewRouter.get('/property/:propertyId', validateObjectId('propertyId'), getPropertyReviews);

// Get all reviews for a specific vehicle
reviewRouter.get('/vehicle/:vehicleId', validateObjectId('vehicleId'), getVehicleReviews);

// Get user's own reviews (requires authentication)
reviewRouter.get('/my-reviews', authUser, getUserReviews);

// Update a review (requires authentication + validation)
reviewRouter.put('/:reviewId', authUser, csrfProtect, reviewLimiter, validateObjectId('reviewId'), validateReview, updateReview);

// Delete a review (requires authentication)
reviewRouter.delete('/:reviewId', authUser, validateObjectId('reviewId'), deleteReview);

export default reviewRouter;

