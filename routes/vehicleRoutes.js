// routes/vehicleRoutes.js
import express from 'express';
import { getVehicleById,searchItems } from '../controller/vehicleController.js';

const vehicleRouter = express.Router();

console.log("Vehicle Routes Loaded");

// Get single vehicle by ID
// Example: /api/vehicle/507f1f77bcf86cd799439011
vehicleRouter.get('/featured', searchItems);
vehicleRouter.get('/:id', getVehicleById);

export default vehicleRouter;
