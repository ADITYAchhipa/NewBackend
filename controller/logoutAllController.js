import User from '../models/user.js';
import logger from '../utils/logger.js';

/**
 * Logout from all devices
 * POST /api/user/logout-all
 * 
 * Increments tokenVersion to invalidate all existing JWT tokens
 * Forces user to re-login on all devices
 */
export const logoutAll = async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        // Find user and increment token version
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // SECURITY: Increment tokenVersion to invalidate ALL sessions
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();

        // Clear cookies on current device
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
        });

        res.clearCookie('csrfToken', {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        });

        logger.userAction('LOGOUT_ALL', userId);

        return res.json({
            success: true,
            message: 'Logged out from all devices successfully'
        });

    } catch (error) {
        console.error('Logout all error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during logout'
        });
    }
};

export default { logoutAll };
