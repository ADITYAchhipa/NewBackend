// routes/vehicleRoutes.js
import express from 'express';
import { getVehicleById, getSimilarVehicles, searchItems } from '../controller/vehicleController.js';
import { validateObjectId } from '../middleware/validateObjectId.js';

const vehicleRouter = express.Router();

console.log("Vehicle Routes Loaded");

// Get single vehicle by ID
// Example: /api/vehicle/507f1f77bcf86cd799439011
vehicleRouter.get('/featured', searchItems);
vehicleRouter.get('/:id/similar', validateObjectId('id'), getSimilarVehicles);
vehicleRouter.get('/:id', validateObjectId('id'), getVehicleById);

export default vehicleRouter;
