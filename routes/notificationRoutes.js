import express from 'express';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  createNotification
} from '../controller/notificationController.js';

const router = express.Router();

// Note: Add your auth middleware here to protect these routes
// e.g., import authMiddleware from '../middleware/auth.js';
// router.use(authMiddleware);

// GET /api/notifications - Get user notifications (with pagination)
router.get('/', getUserNotifications);

// GET /api/notifications/unread-count - Get unread count
router.get('/unread-count', getUnreadCount);

// PUT /api/notifications/:id/read - Mark single notification as read
router.put('/:id/read', markAsRead);

// PUT /api/notifications/mark-all-read - Mark all notifications as read
router.put('/mark-all-read', markAllAsRead);

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', deleteNotification);

// DELETE /api/notifications - Clear all notifications
router.delete('/', clearAllNotifications);

// POST /api/notifications - Create a notification (admin/system use)
router.post('/', createNotification);

export default router;
