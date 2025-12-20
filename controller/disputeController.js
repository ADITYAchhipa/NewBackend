import Dispute from '../models/dispute.js';
import { sanitizeQueryParam } from '../utils/security.js';

// Create a new dispute
export const createDispute = async (req, res) => {
  try {
    const userId = req.userId; // From auth middleware
    const {
      itemType,
      itemId,
      title,
      description,
      category,
      evidence,
      priority,
      metadata
    } = req.body;

    // Validate required fields
    if (!title || !description || !category || !itemType) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, category, and itemType are required'
      });
    }

    // Create new dispute
    const dispute = new Dispute({
      userId,
      itemType,
      itemId,
      title,
      description,
      category,
      evidence: evidence || [],
      priority: priority || 'medium',
      metadata: metadata || {},
      statusHistory: [{
        status: 'pending',
        changedBy: userId,
        changedAt: new Date(),
        notes: 'Dispute created'
      }]
    });

    await dispute.save();

    // Populate user details
    await dispute.populate('userId', 'name email phone avatar');

    res.status(201).json({
      success: true,
      message: 'Dispute created successfully',
      data: dispute
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all disputes for a user
export const getUserDisputes = async (req, res) => {
  try {
    const userId = req.userId;
    const { status, category, page = 1, limit = 10 } = req.query;

    const query = { userId, isActive: true };

    // SECURITY: Sanitize query parameters to prevent NoSQL injection
    const sanitizedStatus = sanitizeQueryParam(status);
    const sanitizedCategory = sanitizeQueryParam(category);

    if (sanitizedStatus) query.status = sanitizedStatus;
    if (sanitizedCategory) query.category = sanitizedCategory;

    const disputes = await Dispute.find(query)
      .populate('userId', 'name email phone avatar')
      .populate('response.respondedBy', 'name email')
      .populate('resolution.resolvedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Dispute.countDocuments(query);

    res.json({
      success: true,
      data: {
        disputes,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get a single dispute by ID
export const getDisputeById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const dispute = await Dispute.findOne({ _id: id, userId, isActive: true })
      .populate('userId', 'name email phone avatar')
      .populate('response.respondedBy', 'name email')
      .populate('resolution.resolvedBy', 'name email')
      .populate('statusHistory.changedBy', 'name email')
      .lean();

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found'
      });
    }

    res.json({
      success: true,
      data: dispute
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update a dispute (user can update before it's under review)
export const updateDispute = async (req, res) => {
  try {
    const disputeId = req.params.id;
    const userId = req.user?.id || req.userId;
    const { title, description, evidence, category, priority } = req.body;

    // SECURITY: Ownership check + status check - only owner can update pending disputes
    const dispute = await Dispute.findOne({
      _id: disputeId,
      userId: userId,  // Ownership check
      status: 'pending',  // Only editable when pending
      isActive: true
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found or cannot be modified'  // Generic message
      });
    }

    // Ownership already verified by query, and status is 'pending'
    // No need for the explicit `if (dispute.status !== 'pending')` check here anymore.

    // Update fields
    if (title) dispute.title = title;
    if (description) dispute.description = description;
    if (evidence) dispute.evidence = evidence;
    if (category) dispute.category = category;
    if (priority) dispute.priority = priority;

    await dispute.save();
    await dispute.populate('userId', 'name email phone avatar');

    res.json({
      success: true,
      message: 'Dispute updated successfully',
      data: dispute
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete (soft delete) a dispute
export const deleteDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.userId; // Changed to use req.user?.id || req.userId

    const dispute = await Dispute.findOne({
      _id: id,
      userId, // Ownership check
      isActive: true
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found'
      });
    }

    // Only allow deletion if status is pending
    if (dispute.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete dispute that is already under review or resolved'
      });
    }

    dispute.isActive = false;
    await dispute.save();

    res.json({
      success: true,
      message: 'Dispute deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get dispute statistics for a user
export const getDisputeStatistics = async (req, res) => {
  try {
    const userId = req.userId;

    const statistics = await Dispute.getStatistics(userId);

    const stats = {
      total: 0,
      pending: 0,
      under_review: 0,
      resolved: 0,
      rejected: 0,
      closed: 0
    };

    statistics.forEach(stat => {
      stats[stat._id] = stat.count;
      stats.total += stat.count;
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all disputes (admin only - you can add admin middleware later)
export const getAllDisputes = async (req, res) => {
  try {
    const { status, category, priority, page = 1, limit = 20 } = req.query;

    const query = { isActive: true };

    // SECURITY: Sanitize query parameters to prevent NoSQL injection
    const sanitizedStatus = sanitizeQueryParam(status);
    const sanitizedCategory = sanitizeQueryParam(category);
    const sanitizedPriority = sanitizeQueryParam(priority);

    if (sanitizedStatus) query.status = sanitizedStatus;
    if (sanitizedCategory) query.category = sanitizedCategory;
    if (sanitizedPriority) query.priority = sanitizedPriority;

    const disputes = await Dispute.find(query)
      .populate('userId', 'name email phone avatar')
      .populate('response.respondedBy', 'name email')
      .populate('resolution.resolvedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Dispute.countDocuments(query);

    res.json({
      success: true,
      data: {
        disputes,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update dispute status (admin only - you can add admin middleware later)
export const updateDisputeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const adminId = req.userId; // Should be admin user ID

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const dispute = await Dispute.findOne({ _id: id, isActive: true });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found'
      });
    }

    await dispute.updateStatus(status, adminId, notes);
    await dispute.populate('userId', 'name email phone avatar');

    res.json({
      success: true,
      message: 'Dispute status updated successfully',
      data: dispute
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
