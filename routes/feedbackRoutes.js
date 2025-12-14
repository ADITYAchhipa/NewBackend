import express from 'express';
import { submitFeedback } from '../controller/feedbackController.js';
import authUser from '../middleware/authUser.js';

const router = express.Router();

// POST /api/feedback - Submit user feedback (requires authentication)
router.post('/', authUser, submitFeedback);

export default router;
