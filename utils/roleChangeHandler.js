/**
 * Role Change Handler
 * Invalidates ALL user sessions when role/permissions change
 * 
 * CRITICAL: Prevents authorization drift attacks
 * 
 * Usage:
 *   import { invalidateUserSessions } from './roleChangeHandler.js';
 *   
 *   // When changing user role
 *   await invalidateUserSessions(userId, 'role_change', { oldRole, newRole });
 */

import User from '../models/user.js';
import { logSecurityEvent, SEVERITY } from './securityLogger.js';

/**
 * Invalidate all user sessions by incrementing tokenVersion
 * Call this when:
 * - User role changes (admin promotion/demotion)
 * - User permissions change
 * - Account status changes
 * - Password changes (already handled)
 */
export async function invalidateUserSessions(userId, reason, metadata = {}) {
    try {
        const user = await User.findById(userId);

        if (!user) {
            return { success: false, error: 'User not found' };
        }

        const oldVersion = user.tokenVersion || 0;
        user.tokenVersion = oldVersion + 1;
        await user.save();

        // Log the invalidation
        logSecurityEvent({
            type: 'SESSION_INVALIDATION',
            severity: SEVERITY.HIGH,
            userId: userId.toString(),
            action: 'all_sessions_invalidated',
            result: 'success',
            metadata: {
                reason,
                oldTokenVersion: oldVersion,
                newTokenVersion: user.tokenVersion,
                ...metadata
            }
        });

        return {
            success: true,
            oldVersion,
            newVersion: user.tokenVersion
        };
    } catch (error) {
        console.error('Session invalidation error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Handle role change with session invalidation
 */
export async function handleRoleChange(userId, newRole, context = {}) {
    try {
        const user = await User.findById(userId);

        if (!user) {
            return { success: false, error: 'User not found' };
        }

        const oldRole = user.isAdmin ? 'admin' : 'user';
        const newIsAdmin = newRole === 'admin';

        // Only invalidate if role actually changed
        if (user.isAdmin === newIsAdmin) {
            return { success: true, changed: false };
        }

        // Update role
        user.isAdmin = newIsAdmin;

        // CRITICAL: Invalidate all sessions
        user.tokenVersion = (user.tokenVersion || 0) + 1;

        await user.save();

        // Log the role change
        logSecurityEvent({
            type: 'ROLE_CHANGE',
            severity: SEVERITY.CRITICAL,
            userId: userId.toString(),
            action: `role_changed_${oldRole}_to_${newRole}`,
            result: 'success',
            metadata: {
                oldRole,
                newRole,
                tokenVersionIncremented: true,
                changedBy: context.adminId || 'system',
                ip: context.ip
            }
        });

        return {
            success: true,
            changed: true,
            oldRole,
            newRole,
            tokenVersion: user.tokenVersion
        };
    } catch (error) {
        console.error('Role change error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Handle account status change
 */
export async function handleAccountStatusChange(userId, newStatus, context = {}) {
    const validStatuses = ['active', 'suspended', 'banned', 'pending'];

    if (!validStatuses.includes(newStatus)) {
        return { success: false, error: 'Invalid status' };
    }

    try {
        const user = await User.findById(userId);

        if (!user) {
            return { success: false, error: 'User not found' };
        }

        const oldStatus = user.accountStatus || 'active';

        // Only invalidate if status actually changed
        if (oldStatus === newStatus) {
            return { success: true, changed: false };
        }

        user.accountStatus = newStatus;

        // CRITICAL: Invalidate sessions on status change
        user.tokenVersion = (user.tokenVersion || 0) + 1;

        await user.save();

        logSecurityEvent({
            type: 'ACCOUNT_STATUS_CHANGE',
            severity: SEVERITY.HIGH,
            userId: userId.toString(),
            action: `status_changed_${oldStatus}_to_${newStatus}`,
            result: 'success',
            metadata: {
                oldStatus,
                newStatus,
                tokenVersionIncremented: true,
                changedBy: context.adminId || 'system'
            }
        });

        return {
            success: true,
            changed: true,
            oldStatus,
            newStatus,
            tokenVersion: user.tokenVersion
        };
    } catch (error) {
        console.error('Account status change error:', error);
        return { success: false, error: error.message };
    }
}

export default {
    invalidateUserSessions,
    handleRoleChange,
    handleAccountStatusChange
};
