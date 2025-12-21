// routes/ownerRoutes.js
import express from 'express';
import {
    getOwnerListings,
    getOwnerDashboardStats,
    createPropertyListing,
    createVehicleListing,
    getOwnerBookings,
    deactivateListing,
    activateListing,
    deleteListing,
    featureListingWithCoins
} from '../controller/ownerController.js';
import { approveBooking, getBlockedDates, checkOverlappingPending, rejectBooking } from '../controller/bookingController.js';
import authUser from '../middleware/authUser.js';

const ownerRouter = express.Router();

console.log("Owner Routes Loaded");

// Get dashboard stats for the logged-in owner
// Example: GET /api/owner/dashboard-stats
ownerRouter.get('/dashboard-stats', authUser, getOwnerDashboardStats);

// Get all listings for the logged-in owner
// Example: GET /api/owner/listings
ownerRouter.get('/listings', authUser, getOwnerListings);

// Create a new property listing
// Example: POST /api/owner/property
ownerRouter.post('/property', authUser, createPropertyListing);

// Create a new vehicle listing
// Example: POST /api/owner/vehicle
ownerRouter.post('/vehicle', authUser, createVehicleListing);

// Get all bookings for the logged-in owner's properties and vehicles
// Example: GET /api/owner/bookings
ownerRouter.get('/bookings', authUser, getOwnerBookings);

// ==================== LISTING MANAGEMENT ====================

// Deactivate a listing (property or vehicle)
// Example: PATCH /api/owner/listings/:id/deactivate?type=property
ownerRouter.patch('/listings/:id/deactivate', authUser, deactivateListing);

// Activate a listing (property or vehicle) - enforces 1-hour cooldown
// Example: PATCH /api/owner/listings/:id/activate?type=property
ownerRouter.patch('/listings/:id/activate', authUser, activateListing);

// Delete a listing (property or vehicle)
// Example: DELETE /api/owner/listings/:id?type=property
ownerRouter.delete('/listings/:id', authUser, deleteListing);

// Feature a listing with coins (300 coins)
// Example: POST /api/owner/listings/:id/feature?type=property
ownerRouter.post('/listings/:id/feature', authUser, featureListingWithCoins);

// ==================== BOOKING MANAGEMENT ====================

// Approve a pending booking (blocks dates atomically)
// Example: POST /api/owner/bookings/:id/approve
ownerRouter.post('/bookings/:id/approve', authUser, approveBooking);

// Reject/Decline a pending booking
// Example: POST /api/owner/bookings/:id/reject
ownerRouter.post('/bookings/:id/reject', authUser, rejectBooking);

// Check for overlapping pending bookings (for UI warning before approval)
// Example: POST /api/owner/bookings/:id/check-overlap
ownerRouter.post('/bookings/:id/check-overlap', authUser, checkOverlappingPending);

// ==================== PUBLIC LISTING INFO ====================

// Get blocked dates for a listing (used by booking calendar)
// Example: GET /api/listings/:id/blocked-dates?type=property
ownerRouter.get('/listings/:id/blocked-dates', getBlockedDates);

export default ownerRouter;
