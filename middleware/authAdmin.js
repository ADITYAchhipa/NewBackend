import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import 'dotenv/config';

/**
 * Admin authorization middleware
 * Checks if authenticated user has admin privileges
 * Must be used AFTER authUser middleware
 */
const authAdmin = async (req, res, next) => {
    try {
        // req.userId is set by authUser middleware
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated"
            });
        }

        // Get user from database to check admin status
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found"
            });
        }

        // Check if user is admin
        if (!user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: "Forbidden. Admin access required."
            });
        }

        // User is admin, proceed
        next();
    } catch (error) {
        console.error('authAdmin error:', error);
        res.status(500).json({
            success: false,
            message: "Authorization error"
        });
    }
};

export default authAdmin;
