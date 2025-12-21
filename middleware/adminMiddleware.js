// ============================================================================
// Admin Middleware
// ============================================================================
// Verifies that the authenticated user has admin privileges

import User from '../models/user.js';

export const requireAdmin = async (req, res, next) => {
    try {
        // Check if user is authenticated (authUser sets req.userId)
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Fetch user from database to check admin status
        const user = await User.findById(req.userId).select('isAdmin');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user has admin privileges
        if (!user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }

        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error validating admin privileges'
        });
    }
};
