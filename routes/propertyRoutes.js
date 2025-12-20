// routes/propertyRoutes.js
import express from 'express';
import { getPropertyById } from '../controller/propertyController.js';
import { searchItems } from '../controller/propertyController.js';
import { validateObjectId } from '../middleware/validateObjectId.js';

const propertyRouter = express.Router();

console.log("Property Routes Loaded");

// Get single property by ID
// Example: /api/property/507f1f77bcf86cd799439011
propertyRouter.get('/featured', searchItems);
propertyRouter.get('/:id', validateObjectId('id'), getPropertyById);




export default propertyRouter;
