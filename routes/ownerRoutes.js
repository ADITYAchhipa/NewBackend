// routes/ownerRoutes.js
import express from 'express';
import { getOwnerListings, getOwnerDashboardStats } from '../controller/ownerController.js';
import authUser from '../middleware/authUser.js';

const ownerRouter = express.Router();

console.log("Owner Routes Loaded");

// Get dashboard stats for the logged-in owner
// Example: GET /api/owner/dashboard-stats
ownerRouter.get('/dashboard-stats', authUser, getOwnerDashboardStats);

// Get all listings for the logged-in owner
// Example: GET /api/owner/listings
ownerRouter.get('/listings', authUser, getOwnerListings);

export default ownerRouter;
