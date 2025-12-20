import express from 'express';
import {
  createDispute,
  getUserDisputes,
  getDisputeById,
  updateDispute,
  deleteDispute,
  getDisputeStatistics,
  getAllDisputes,
  updateDisputeStatus
} from '../controller/disputeController.js';
import authUser from '../middleware/authUser.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { disputeLimiter } from '../middleware/advancedRateLimiter.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authUser);

/**
 * POST /api/disputes
 * Create a new dispute
 * 
 * Body:
 * - itemType (required): 'property' | 'vehicle' | 'booking' | 'payment' | 'other'
 * - itemId (optional): ID of the disputed item
 * - title (required): Short title of the dispute
 * - description (required): Detailed description
 * - category (required): 'payment_issue' | 'service_quality' | 'damaged_property' | 'misleading_information' | 'safety_concern' | 'cancellation_dispute' | 'refund_issue' | 'other'
 * - evidence (optional): Array of URLs to evidence files
 * - priority (optional): 'low' | 'medium' | 'high' | 'urgent' (default: 'medium')
 * - metadata (optional): Additional metadata (ipAddress, userAgent, location)
 * 
 * Example:
 * {
 *   "itemType": "property",
 *   "itemId": "507f1f77bcf86cd799439011",
 *   "title": "Property not as described",
 *   "description": "The property photos showed a much larger space...",
 *   "category": "misleading_information",
 *   "priority": "high",
 *   "evidence": ["https://example.com/photo1.jpg"]
 * }
 */
router.post('/', disputeLimiter, createDispute);

/**
 * GET /api/disputes
 * Get all disputes for the authenticated user
 * 
 * Query Parameters:
 * - status (optional): Filter by status ('pending', 'under_review', 'resolved', 'rejected', 'closed')
 * - category (optional): Filter by category
 * - page (optional): Page number (default: 1)
 * - limit (optional): Results per page (default: 10)
 * 
 * Example: /api/disputes?status=pending&page=1&limit=10
 */
router.get('/', getUserDisputes);

/**
 * GET /api/disputes/statistics
 * Get dispute statistics for the authenticated user
 * 
 * Returns count of disputes by status
 */
router.get('/statistics', getDisputeStatistics);

/**
 * GET /api/disputes/all
 * Get all disputes (Admin only - add admin middleware if needed)
 * 
 * Query Parameters:
 * - status (optional): Filter by status
 * - category (optional): Filter by category
 * - priority (optional): Filter by priority
 * - page (optional): Page number (default: 1)
 * - limit (optional): Results per page (default: 20)
 * 
 * Example: /api/disputes/all?status=pending&priority=high
 */
router.get('/all', getAllDisputes);

/**
 * GET /api/disputes/:id
 * Get a specific dispute by ID
 * 
 * Params:
 * - id: Dispute ID
 * 
 * Example: /api/disputes/507f1f77bcf86cd799439011
 */
router.get('/:id', validateObjectId('id'), getDisputeById);

/**
 * PUT /api/disputes/:id
 * Update a dispute (only if status is 'pending')
 * 
 * Params:
 * - id: Dispute ID
 * 
 * Body (all optional):
 * - title: Update title
 * - description: Update description
 * - evidence: Update evidence array
 * - category: Update category
 * - priority: Update priority
 * 
 * Example:
 * PUT /api/disputes/507f1f77bcf86cd799439011
 * {
 *   "description": "Updated description with more details...",
 *   "priority": "urgent"
 * }
 */
router.put('/:id', disputeLimiter, validateObjectId('id'), updateDispute);

/**
 * DELETE /api/disputes/:id
 * Delete a dispute (soft delete, only if status is 'pending')
 * 
 * Params:
 * - id: Dispute ID
 * 
 * Example: DELETE /api/disputes/507f1f77bcf86cd799439011
 */
router.delete('/:id', validateObjectId('id'), deleteDispute);

/**
 * PATCH /api/disputes/:id/status
 * Update dispute status (Admin only - add admin middleware if needed)
 * 
 * Params:
 * - id: Dispute ID
 * 
 * Body:
 * - status (required): New status ('pending' | 'under_review' | 'resolved' | 'rejected' | 'closed')
 * - notes (optional): Notes about the status change
 * 
 * Example:
 * PATCH /api/disputes/507f1f77bcf86cd799439011/status
 * {
 *   "status": "under_review",
 *   "notes": "Assigned to support team"
 * }
 */
router.patch('/:id/status', validateObjectId('id'), updateDisputeStatus);

export default router;
