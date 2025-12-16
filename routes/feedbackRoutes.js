import express from 'express';
import { submitFeedback } from '../controller/feedbackController.js';
import authUser from '../middleware/authUser.js';
import { preventNoSQLInjection, sanitizeRequest, validateFeedback } from '../middleware/inputValidator.js';

const router = express.Router();

// Apply security middleware
router.use(preventNoSQLInjection);
router.use(sanitizeRequest);

// POST /api/feedback - Submit user feedback (requires authentication + validation)
router.post('/', authUser, validateFeedback, submitFeedback);

export default router;
