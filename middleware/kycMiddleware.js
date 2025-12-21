// ============================================================================
// KYC Validation Middleware
// ============================================================================
// Ensures user has completed KYC before accessing sensitive wallet operations

import User from '../models/user.js';

export const requireKYC = async (req, res, next) => {
    try {
        // Check if user is authenticated (authUser sets req.userId)
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Fetch user from database to check KYC status
        const user = await User.findById(req.userId).select('kyc');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check KYC status
        if (user.kyc !== 'completed') {
            return res.status(403).json({
                success: false,
                message: 'KYC verification required to access this feature',
                kycStatus: user.kyc,
                hint: 'Please complete your KYC verification to use wallet features'
            });
        }

        next();
    } catch (error) {
        console.error('KYC middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error validating KYC status'
        });
    }
};

// Optional: KYC check that doesn't block the request, just adds warning
export const warnKYC = async (req, res, next) => {
    if (req.userId) {
        const user = await User.findById(req.userId).select('kyc');
        if (user && user.kyc !== 'completed') {
            req.kycWarning = true;
        }
    }
    next();
};
