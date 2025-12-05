// routes/search.route.js
import express from 'express'
import { searchItems, getPaginatedSearchResults } from '../controller/searchController.js';

const router = express.Router();
router.get('/all', searchItems);
router.get('/paginated', getPaginatedSearchResults);

export default router;