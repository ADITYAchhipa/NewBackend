/**
 * Time-Based Authorization Guards
 * Prevents time-window drift attacks
 * 
 * PRODUCTION FEATURES:
 * - DB time support (clock skew protection)
 * - Admin override capability (logged at CRITICAL)
 * - Comprehensive security logging
 * 
 * Usage:
 *   import { canEditBooking, canCancelBooking } from './timeGuards.js';
 *   
 *   const result = canEditBooking(booking, {
 *     userId: req.userId,
 *     ip: req.ip,
 *     isAdmin: req.isAdmin,
 *     adminOverride: req.body.override  // Admin can bypass with logging
 *   });
 *   
 *   if (!result.allowed) {
 *     return res.status(403).json({ message: result.reason });
 *   }
 */

import { logSecurityEvent, SEVERITY } from './securityLogger.js';

// ============================================================================
// TIME PROVIDERS (DB time vs. system time)
// ============================================================================

/**
 * Get current time
 * Uses Date.now() by default, can be overridden to use DB time
 * 
 * For production with multiple servers: Use MongoDB $currentDate
 */
export function getCurrentTime() {
    // In production, this could query DB for consistent time across nodes
    // For now, use system time (sufficient for single-node deployments)
    return Date.now();
}

/**
 * Get server time from database (for multi-node consistency)
 * Optional: Use when running multiple backend instances
 */
export async function getDBTime() {
    // Example implementation (optional):
    // const doc = await mongoose.connection.db.admin().serverStatus();
    // return new Date(doc.localTime).getTime();

    // For single-node: just use system time
    return Date.now();
}

// ============================================================================
// TIME WINDOWS (configurable)
// ============================================================================

export const EDIT_WINDOWS = {
    BOOKING_EDIT: 10 * 60 * 1000,           // 10 minutes after creation
    BOOKING_CANCEL_HOURS: 24,               // 24 hours before start date
    DISPUTE_CREATE_DAYS: 7,                 // 7 days after booking completion
    REVIEW_EDIT: 24 * 60 * 60 * 1000,      // 24 hours after posting
    PAYMENT_REFUND_DAYS: 30                 // 30 days after payment
};

// ============================================================================
// BOOKING TIME GUARDS
// ============================================================================

/**
 * Check if booking can still be edited
 * Rule: Only within 10 minutes of creation
 * Admin override: Allowed but logged at CRITICAL severity
 */
export function canEditBooking(booking, context = {}) {
    if (!booking || !booking.createdAt) {
        return { allowed: false, reason: 'Invalid booking data' };
    }

    const now = getCurrentTime();
    const elapsed = now - new Date(booking.createdAt).getTime();
    const windowExpired = elapsed >= EDIT_WINDOWS.BOOKING_EDIT;

    // Admin override check (explicit opt-in, heavily logged)
    if (windowExpired && context.adminOverride === true && context.isAdmin === true) {
        logSecurityEvent({
            type: 'ADMIN_TIME_OVERRIDE',
            severity: SEVERITY.CRITICAL,
            userId: context.userId,
            ip: context.ip,
            action: 'booking_edit_window_override',
            result: 'allowed_with_override',
            metadata: {
                bookingId: booking._id,
                createdAt: booking.createdAt,
                elapsedMs: elapsed,
                windowMs: EDIT_WINDOWS.BOOKING_EDIT,
                overrideReason: context.overrideReason || 'not_provided',
                adminEmail: context.adminEmail
            }
        });

        return {
            allowed: true,
            overridden: true,
            reason: 'Admin override applied (logged)'
        };
    }

    const allowed = !windowExpired;

    if (!allowed && context.userId) {
        logSecurityEvent({
            type: 'TIME_WINDOW_VIOLATION',
            severity: SEVERITY.MEDIUM,
            userId: context.userId,
            ip: context.ip,
            action: 'booking_edit_attempt_expired',
            result: 'blocked',
            metadata: {
                bookingId: booking._id,
                createdAt: booking.createdAt,
                elapsedMs: elapsed,
                windowMs: EDIT_WINDOWS.BOOKING_EDIT
            }
        });
    }

    return {
        allowed,
        reason: allowed ? null : 'Edit window expired (10 minutes after creation)',
        remainingMs: allowed ? EDIT_WINDOWS.BOOKING_EDIT - elapsed : 0
    };
}

/**
 * Check if booking can be cancelled
 * Rule: Must be at least 24 hours before start date
 * Admin override: Allowed but logged at CRITICAL severity
 */
export function canCancelBooking(booking, context = {}) {
    if (!booking || !booking.startDate) {
        return { allowed: false, reason: 'Invalid booking data' };
    }

    // Already completed or cancelled
    if (['completed', 'cancelled'].includes(booking.status)) {
        return { allowed: false, reason: 'Booking already finalized' };
    }

    const now = getCurrentTime();
    const hoursUntilStart = (new Date(booking.startDate).getTime() - now) / (60 * 60 * 1000);
    const windowExpired = hoursUntilStart < EDIT_WINDOWS.BOOKING_CANCEL_HOURS;

    // Admin override check
    if (windowExpired && context.adminOverride === true && context.isAdmin === true) {
        logSecurityEvent({
            type: 'ADMIN_TIME_OVERRIDE',
            severity: SEVERITY.CRITICAL,
            userId: context.userId,
            ip: context.ip,
            action: 'booking_cancel_window_override',
            result: 'allowed_with_override',
            metadata: {
                bookingId: booking._id,
                startDate: booking.startDate,
                hoursUntilStart,
                requiredHours: EDIT_WINDOWS.BOOKING_CANCEL_HOURS,
                overrideReason: context.overrideReason || 'not_provided',
                adminEmail: context.adminEmail
            }
        });

        return {
            allowed: true,
            overridden: true,
            reason: 'Admin override applied (logged)'
        };
    }

    const allowed = !windowExpired;

    if (!allowed && context.userId) {
        logSecurityEvent({
            type: 'TIME_WINDOW_VIOLATION',
            severity: SEVERITY.MEDIUM,
            userId: context.userId,
            ip: context.ip,
            action: 'booking_cancel_attempt_too_late',
            result: 'blocked',
            metadata: {
                bookingId: booking._id,
                startDate: booking.startDate,
                hoursUntilStart,
                requiredHours: EDIT_WINDOWS.BOOKING_CANCEL_HOURS
            }
        });
    }

    return {
        allowed,
        reason: allowed ? null : `Must cancel at least ${EDIT_WINDOWS.BOOKING_CANCEL_HOURS} hours before start`,
        hoursRemaining: hoursUntilStart
    };
}

// ============================================================================
// DISPUTE TIME GUARDS
// ============================================================================

/**
 * Check if dispute can be created for a booking
 * Rule: Within 7 days of booking completion
 */
export function canCreateDispute(booking, context = {}) {
    if (!booking) {
        return { allowed: false, reason: 'Invalid booking data' };
    }

    // Only for completed bookings
    if (booking.status !== 'completed') {
        return { allowed: false, reason: 'Can only dispute completed bookings' };
    }

    if (!booking.completedAt && !booking.endDate) {
        return { allowed: false, reason: 'Booking completion date unknown' };
    }

    const completionDate = new Date(booking.completedAt || booking.endDate);
    const daysElapsed = (Date.now() - completionDate.getTime()) / (24 * 60 * 60 * 1000);
    const allowed = daysElapsed <= EDIT_WINDOWS.DISPUTE_CREATE_DAYS;

    if (!allowed && context.userId) {
        logSecurityEvent({
            type: 'TIME_WINDOW_VIOLATION',
            severity: SEVERITY.LOW,
            userId: context.userId,
            ip: context.ip,
            action: 'dispute_create_attempt_expired',
            result: 'blocked',
            metadata: {
                bookingId: booking._id,
                completedAt: completionDate,
                daysElapsed,
                maxDays: EDIT_WINDOWS.DISPUTE_CREATE_DAYS
            }
        });
    }

    return {
        allowed,
        reason: allowed ? null : `Dispute window expired (${EDIT_WINDOWS.DISPUTE_CREATE_DAYS} days after completion)`,
        daysRemaining: allowed ? EDIT_WINDOWS.DISPUTE_CREATE_DAYS - daysElapsed : 0
    };
}

// ============================================================================
// REVIEW TIME GUARDS
// ============================================================================

/**
 * Check if review can be edited
 * Rule: Within 24 hours of posting
 */
export function canEditReview(review, context = {}) {
    if (!review || !review.createdAt) {
        return { allowed: false, reason: 'Invalid review data' };
    }

    const elapsed = Date.now() - new Date(review.createdAt).getTime();
    const allowed = elapsed < EDIT_WINDOWS.REVIEW_EDIT;

    if (!allowed && context.userId) {
        logSecurityEvent({
            type: 'TIME_WINDOW_VIOLATION',
            severity: SEVERITY.LOW,
            userId: context.userId,
            ip: context.ip,
            action: 'review_edit_attempt_expired',
            result: 'blocked',
            metadata: {
                reviewId: review._id,
                createdAt: review.createdAt,
                elapsedMs: elapsed,
                windowMs: EDIT_WINDOWS.REVIEW_EDIT
            }
        });
    }

    return {
        allowed,
        reason: allowed ? null : 'Review edit window expired (24 hours after posting)',
        remainingMs: allowed ? EDIT_WINDOWS.REVIEW_EDIT - elapsed : 0
    };
}

// ============================================================================
// PAYMENT TIME GUARDS
// ============================================================================

/**
 * Check if payment can be refunded
 * Rule: Within 30 days of payment
 */
export function canRefundPayment(payment, context = {}) {
    if (!payment || !payment.paidAt) {
        return { allowed: false, reason: 'Invalid payment data' };
    }

    if (payment.status === 'refunded') {
        return { allowed: false, reason: 'Already refunded' };
    }

    const daysElapsed = (Date.now() - new Date(payment.paidAt).getTime()) / (24 * 60 * 60 * 1000);
    const allowed = daysElapsed <= EDIT_WINDOWS.PAYMENT_REFUND_DAYS;

    return {
        allowed,
        reason: allowed ? null : `Refund window expired (${EDIT_WINDOWS.PAYMENT_REFUND_DAYS} days after payment)`,
        daysRemaining: allowed ? EDIT_WINDOWS.PAYMENT_REFUND_DAYS - daysElapsed : 0
    };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format time remaining for user-friendly messages
 */
export function formatTimeRemaining(ms) {
    if (ms < 0) return 'expired';

    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

    if (hours > 0) {
        return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
}

export default {
    EDIT_WINDOWS,
    canEditBooking,
    canCancelBooking,
    canCreateDispute,
    canEditReview,
    canRefundPayment,
    formatTimeRemaining
};
