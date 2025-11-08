import { Schema, model } from 'mongoose';

const DisputeSchema = new Schema({
  // User who raised the dispute
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },

  // Type of item the dispute is about
  itemType: { 
    type: String, 
    enum: ['property', 'vehicle', 'booking', 'payment', 'other'],
    required: true 
  },

  // Reference to the disputed item
  itemId: { 
    type: Schema.Types.ObjectId, 
    refPath: 'itemType',
    index: true 
  },

  // Dispute details
  title: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 200
  },

  description: { 
    type: String, 
    required: true,
    maxlength: 2000
  },

  category: {
    type: String,
    enum: [
      'payment_issue',
      'service_quality',
      'damaged_property',
      'misleading_information',
      'safety_concern',
      'cancellation_dispute',
      'refund_issue',
      'other'
    ],
    required: true
  },

  // Evidence (images, documents, etc.)
  evidence: [{
    type: String, // URL to the uploaded file
    trim: true
  }],

  // Dispute status
  status: {
    type: String,
    enum: ['pending', 'under_review', 'resolved', 'rejected', 'closed'],
    default: 'pending',
    index: true
  },

  // Priority level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Admin/Support response
  response: {
    message: String,
    respondedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    respondedAt: Date
  },

  // Resolution details
  resolution: {
    outcome: {
      type: String,
      enum: ['in_favor_of_user', 'in_favor_of_other', 'partial_resolution', 'no_action', 'dismissed']
    },
    notes: String,
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date
  },

  // Additional metadata
  metadata: {
    ipAddress: String,
    userAgent: String,
    location: {
      latitude: Number,
      longitude: Number
    }
  },

  // History of status changes
  statusHistory: [{
    status: String,
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    notes: String
  }],

  // Soft delete
  isActive: { 
    type: Boolean, 
    default: true 
  }

}, { 
  timestamps: true 
});

// Indexes for better query performance
DisputeSchema.index({ userId: 1, status: 1 });
DisputeSchema.index({ itemType: 1, itemId: 1 });
DisputeSchema.index({ createdAt: -1 });

// Instance method to update status
DisputeSchema.methods.updateStatus = function(newStatus, changedBy, notes) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    changedBy,
    changedAt: new Date(),
    notes
  });
  return this.save();
};

// Static method to get user disputes
DisputeSchema.statics.getUserDisputes = function(userId, filters = {}) {
  const query = { userId, isActive: true, ...filters };
  return this.find(query)
    .populate('userId', 'name email phone avatar')
    .sort({ createdAt: -1 })
    .lean();
};

// Static method to get dispute statistics
DisputeSchema.statics.getStatistics = function(userId) {
  return this.aggregate([
    { $match: { userId, isActive: true } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

export default model('Dispute', DisputeSchema);
