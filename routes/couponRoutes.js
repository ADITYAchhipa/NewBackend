// routes/couponRoutes.js
import { Router } from 'express';
import {
    getAvailableCoupons,
    getMyCoupons,
    claimCoupon,
    validateCoupon,
    applyCouponToBooking
} from '../controller/couponController.js';
import authUser from '../middleware/authUser.js';
import { writeLimiter, writeBurstLimiter } from '../middleware/advancedRateLimiter.js';

const couponRouter = Router();

console.log("Coupon Routes Loaded");

// All coupon routes require authentication
couponRouter.use(authUser);

/**
 * GET /api/coupons/available
 * Get all active coupons available to the user (public + targeted)
 */
couponRouter.get('/available', getAvailableCoupons);

/**
 * GET /api/coupons/my-coupons
 * Get user's claimed coupons
 * Query params: includeUsed=true (to include fully used coupons)
 */
couponRouter.get('/my-coupons', getMyCoupons);

/**
 * POST /api/coupons/claim/:code
 * Claim a coupon by code
 * Body: { notificationId? } (optional)
 * Rate limited to prevent abuse
 */
couponRouter.post('/claim/:code', writeBurstLimiter, writeLimiter, claimCoupon);

/**
 * POST /api/coupons/validate
 * Validate if a coupon can be applied (without applying it)
 * Body: { code, bookingAmount, bookingType }
 */
couponRouter.post('/validate', validateCoupon);

/**
 * POST /api/coupons/apply
 * Apply a coupon to a booking
 * Body: { bookingId, couponCode }
 * Rate limited to prevent abuse
 */
couponRouter.post('/apply', writeBurstLimiter, writeLimiter, applyCouponToBooking);

export default couponRouter;
