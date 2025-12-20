// routes/search.route.js
import { Router } from 'express';
import { searchItems, getPaginatedSearchResults } from '../controller/searchController.js';
import { searchLimiter, searchBurstLimiter } from '../middleware/advancedRateLimiter.js';

const router = Router();

// Search routes - both use the generic searchItems function with type query param
// Example: /api/search?type=property&query=apartment
// Example: /api/search?type=vehicle&query=sedan
router.get('/', searchLimiter, searchBurstLimiter, searchItems);

// Paginated search with advanced sorting
// Example: /api/search/paginated?type=property&page=1&limit=20&sort=relevance
router.get('/paginated', searchLimiter, searchBurstLimiter, getPaginatedSearchResults);

export default router;