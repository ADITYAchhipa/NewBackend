import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import 'dotenv/config';
import { logSecurityEvent, SEVERITY } from '../utils/securityLogger.js';

/**
 * Admin authorization middleware
 * Checks if authenticated user has admin privileges
 * Must be used AFTER authUser middleware
 * 
 * CRITICAL: All admin actions are logged for security audit
 */
const authAdmin = async (req, res, next) => {
    try {
        // req.userId is set by authUser middleware
        if (!req.userId) {
            logSecurityEvent({
                type: 'ADMIN_ACCESS_DENIED',
                severity: SEVERITY.HIGH,
                userId: 'anonymous',
                ip: req.ip,
                action: 'admin_route_no_auth',
                resource: req.path,
                result: 'blocked'
            });

            return res.status(401).json({
                success: false,
                message: "Not authenticated"
            });
        }

        // Get user from database to check admin status
        const user = await User.findById(req.userId).select('isAdmin name email');

        if (!user) {
            logSecurityEvent({
                type: 'ADMIN_ACCESS_DENIED',
                severity: SEVERITY.HIGH,
                userId: req.userId,
                ip: req.ip,
                action: 'admin_route_user_not_found',
                resource: req.path,
                result: 'blocked'
            });

            return res.status(401).json({
                success: false,
                message: "User not found"
            });
        }

        // Check if user is admin
        if (!user.isAdmin) {
            logSecurityEvent({
                type: 'ADMIN_ACCESS_DENIED',
                severity: SEVERITY.CRITICAL,
                userId: req.userId,
                ip: req.ip,
                action: 'unauthorized_admin_access_attempt',
                resource: req.originalUrl,
                result: 'blocked',
                metadata: {
                    userEmail: user.email,
                    userName: user.name,
                    attemptedRoute: req.originalUrl,
                    method: req.method
                }
            });

            return res.status(403).json({
                success: false,
                message: "Forbidden. Admin access required."
            });
        }

        // User is admin - attach info and log action
        req.isAdmin = true;
        req.adminEmail = user.email;
        req.adminName = user.name;

        // Log ALL admin actions
        logSecurityEvent({
            type: 'ADMIN_ACTION',
            severity: SEVERITY.MEDIUM,
            userId: req.userId,
            ip: req.ip,
            action: `${req.method} ${req.path}`,
            resource: req.originalUrl,
            result: 'allowed',
            metadata: {
                adminEmail: user.email,
                adminName: user.name
            }
        });

        next();
    } catch (error) {
        console.error('authAdmin error:', error);

        logSecurityEvent({
            type: 'ADMIN_AUTH_ERROR',
            severity: SEVERITY.HIGH,
            userId: req.userId || 'unknown',
            ip: req.ip,
            action: 'admin_auth_exception',
            result: 'error',
            metadata: { error: error.message }
        });

        res.status(500).json({
            success: false,
            message: "Authorization error"
        });
    }
};

export default authAdmin;
