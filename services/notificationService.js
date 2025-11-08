import Notification from '../models/notification.js';

class NotificationService {
  /**
   * Send a notification to a user
   * @param {Object} options - Notification options
   * @param {String} options.userId - User ID
   * @param {String} options.title - Notification title
   * @param {String} options.message - Notification message
   * @param {String} options.type - Notification type
   * @param {Object} options.data - Additional data
   * @param {String} options.priority - Priority level
   * @param {String} options.actionUrl - Action URL
   * @param {String} options.imageUrl - Image URL
   * @param {Date} options.expiresAt - Expiry date
   */
  async sendNotification({
    userId,
    title,
    message,
    type,
    data = {},
    priority = 'medium',
    actionUrl,
    imageUrl,
    expiresAt
  }) {
    try {
      const notification = new Notification({
        userId,
        title,
        message,
        type,
        data,
        priority,
        actionUrl,
        imageUrl,
        expiresAt
      });

      await notification.save();

      // TODO: Implement push notification delivery
      // await this.sendPushNotification(notification);

      return notification;
    } catch (error) {
      console.error('Failed to send notification:', error);
      throw error;
    }
  }

  /**
   * Send booking-related notification
   */
  async sendBookingNotification(userId, bookingData, status) {
    const titles = {
      confirmed: 'Booking Confirmed',
      cancelled: 'Booking Cancelled',
      completed: 'Booking Completed',
      pending: 'Booking Pending'
    };

    const messages = {
      confirmed: `Your booking for ${bookingData.propertyName} has been confirmed!`,
      cancelled: `Your booking for ${bookingData.propertyName} has been cancelled.`,
      completed: `Your booking for ${bookingData.propertyName} is complete. Please leave a review!`,
      pending: `Your booking request for ${bookingData.propertyName} is pending approval.`
    };

    return this.sendNotification({
      userId,
      title: titles[status] || 'Booking Update',
      message: messages[status] || 'Your booking status has been updated',
      type: 'booking',
      priority: status === 'confirmed' ? 'high' : 'medium',
      data: { bookingId: bookingData.bookingId, ...bookingData },
      actionUrl: `/bookings/${bookingData.bookingId}`
    });
  }

  /**
   * Send payment notification
   */
  async sendPaymentNotification(userId, paymentData) {
    return this.sendNotification({
      userId,
      title: paymentData.success ? 'Payment Successful' : 'Payment Failed',
      message: paymentData.success 
        ? `Payment of ${paymentData.amount} ${paymentData.currency} received successfully`
        : `Payment failed. Please try again.`,
      type: 'payment',
      priority: 'high',
      data: paymentData,
      actionUrl: `/payments/${paymentData.paymentId}`
    });
  }

  /**
   * Send message notification
   */
  async sendMessageNotification(userId, messageData) {
    return this.sendNotification({
      userId,
      title: 'New Message',
      message: `You have a new message from ${messageData.senderName}`,
      type: 'message',
      priority: 'medium',
      data: messageData,
      actionUrl: `/chat/${messageData.conversationId}`
    });
  }

  /**
   * Send review notification
   */
  async sendReviewNotification(userId, reviewData) {
    return this.sendNotification({
      userId,
      title: 'New Review',
      message: `${reviewData.reviewerName} left a ${reviewData.rating}-star review`,
      type: 'review',
      priority: 'low',
      data: reviewData,
      actionUrl: `/reviews/${reviewData.reviewId}`
    });
  }

  /**
   * Send promotional notification
   */
  async sendPromotionalNotification(userId, promoData) {
    return this.sendNotification({
      userId,
      title: promoData.title || 'Special Offer',
      message: promoData.message,
      type: 'promotion',
      priority: 'low',
      data: promoData,
      imageUrl: promoData.imageUrl,
      actionUrl: promoData.actionUrl,
      expiresAt: promoData.expiresAt
    });
  }

  /**
   * Send price alert notification
   */
  async sendPriceAlertNotification(userId, alertData) {
    return this.sendNotification({
      userId,
      title: 'Price Drop Alert',
      message: `${alertData.propertyName} price dropped to ${alertData.newPrice}!`,
      type: 'price_alert',
      priority: 'medium',
      data: alertData,
      actionUrl: `/properties/${alertData.propertyId}`
    });
  }

  /**
   * Send system notification
   */
  async sendSystemNotification(userId, title, message, data = {}) {
    return this.sendNotification({
      userId,
      title,
      message,
      type: 'system',
      priority: 'high',
      data
    });
  }

  /**
   * Bulk send notifications to multiple users
   */
  async sendBulkNotifications(userIds, notificationData) {
    try {
      const notifications = userIds.map(userId => ({
        userId,
        ...notificationData,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const result = await Notification.insertMany(notifications);

      // TODO: Send push notifications in bulk
      
      return result;
    } catch (error) {
      console.error('Failed to send bulk notifications:', error);
      throw error;
    }
  }

  // TODO: Implement push notification delivery via FCM or WebSocket
  async sendPushNotification(notification) {
    // Implement FCM or other push notification service here
    console.log('Push notification would be sent:', notification);
  }
}

export default new NotificationService();
