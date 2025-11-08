import { Schema, model } from 'mongoose';

const NotificationSchema = new Schema({
  // User reference
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },

  // Content
  title: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    required: true,
    enum: ['booking', 'payment', 'message', 'review', 'system', 'promotion', 'price_alert', 'reminder'],
    index: true
  },

  // Additional data (flexible JSON structure)
  data: { 
    type: Schema.Types.Mixed,
    default: {} 
  },

  // Status
  isRead: { 
    type: Boolean, 
    default: false,
    index: true 
  },
  readAt: { 
    type: Date 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },

  // Priority
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Optional fields
  actionUrl: String,      // Deep link or URL to navigate to
  imageUrl: String,       // Optional notification image
  expiresAt: Date,        // Auto-delete after this date

  // Delivery tracking
  deliveredAt: Date,
  clickedAt: Date,

}, { 
  timestamps: true  // Adds createdAt and updatedAt automatically
});

// Indexes for efficient queries
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, type: 1 });
NotificationSchema.index({ expiresAt: 1 }, { sparse: true });

// Auto-delete expired notifications
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for checking if notification is expired
NotificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Method to mark as read
NotificationSchema.methods.markAsRead = async function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Method to mark as delivered
NotificationSchema.methods.markAsDelivered = async function() {
  this.deliveredAt = new Date();
  return this.save();
};

// Method to mark as clicked
NotificationSchema.methods.markAsClicked = async function() {
  this.clickedAt = new Date();
  return this.save();
};

// Static method to get unread count for a user
NotificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({ userId, isRead: false, isActive: true });
};

// Static method to mark all as read for a user
NotificationSchema.statics.markAllAsReadForUser = async function(userId) {
  return this.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

export default model('Notification', NotificationSchema);
