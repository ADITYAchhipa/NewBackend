// routes/ownerRoutes.js
import express from 'express';
import { getOwnerListings } from '../controller/ownerController.js';
import authUser from '../middleware/authUser.js';

const ownerRouter = express.Router();

console.log("Owner Routes Loaded");

// Get all listings for the logged-in owner
// Example: GET /api/owner/listings
ownerRouter.get('/listings', authUser, getOwnerListings);

export default ownerRouter;
