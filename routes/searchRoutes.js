// routes/search.route.js
import express from 'express'
import { searchItems } from '../controller/searchController.js';

const router = express.Router();
router.get('/all', searchItems);

export default router;