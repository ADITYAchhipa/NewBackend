// filterRoutes.js - Search filter routes
import express from 'express';
import { filterProperties, getFilterOptions } from '../controller/filterController.js';

const router = express.Router();

// POST /api/filter/properties - Filter properties with pagination
router.post('/properties', filterProperties);

// GET /api/filter/options - Get available filter options
router.get('/options', getFilterOptions);

export default router;
