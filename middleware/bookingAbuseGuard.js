/**
 * Booking Abuse Prevention Middleware
 * 
 * Protects against:
 * - Fake booking spam
 * - Inventory blocking
 * - Cancellation loops
 * - Repeat offenders
 */

import Booking from '../models/booking.js';
import { logSecurityEvent, SEVERITY, EVENT_TYPE } from '../utils/securityLogger.js';

/**
 * Check if user has too many active bookings
 */
export const checkActiveBookingLimit = async (req, res, next) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return next(); // Let auth middleware handle
        }

        const activeBookings = await Booking.countDocuments({
            userId,
            status: { $in: ['pending', 'confirmed'] }
        });

        if (activeBookings >= 5) {
            logSecurityEvent({
                type: 'BOOKING_LIMIT_EXCEEDED',
                severity: SEVERITY.MEDIUM,
                userId,
                ip: req.ip,
                action: 'booking_creation_attempt',
                result: 'blocked',
                metadata: { activeBookings, limit: 5 }
            });

            return res.status(429).json({
                success: false,
                message: 'Maximum active bookings reached (5). Please complete or cancel existing bookings first.'
            });
        }

        req.activeBookingsCount = activeBookings;
        next();
    } catch (error) {
        console.error('Active booking check error:', error);
        next(); // Don't block on error
    }
};

/**
 * Enforce cooldown between booking creations
 */
export const checkBookingCooldown = async (req, res, next) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return next();
        }

        // Check cancellation history to adjust cooldown
        const recentCancellations = await Booking.countDocuments({
            userId,
            status: 'cancelled',
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        });

        // Escalating cooldown based on cancellations
        let cooldownMinutes = 5; // Default 5 minutes

        if (recentCancellations >= 5) {
            cooldownMinutes = 60; // 1 hour cooldown for repeat offenders
        } else if (recentCancellations >= 3) {
            cooldownMinutes = 30; // 30 minutes for suspicious pattern
        } else if (recentCancellations >= 2) {
            cooldownMinutes = 15; // 15 minutes for multiple cancellations
        }

        // Check last booking
        const lastBooking = await Booking.findOne({
            userId,
            createdAt: { $gte: new Date(Date.now() - cooldownMinutes * 60 * 1000) }
        }).sort({ createdAt: -1 });

        if (lastBooking) {
            const remainingCooldown = Math.ceil(
                (lastBooking.createdAt.getTime() + cooldownMinutes * 60 * 1000 - Date.now()) / 60000
            );

            logSecurityEvent({
                type: 'BOOKING_COOLDOWN_ACTIVE',
                severity: SEVERITY.LOW,
                userId,
                ip: req.ip,
                action: 'booking_creation_attempt',
                result: 'blocked',
                metadata: {
                    cooldownMinutes,
                    recentCancellations,
                    remainingMinutes: remainingCooldown
                }
            });

            return res.status(429).json({
                success: false,
                message: `Please wait ${remainingCooldown} minute(s) before creating another booking.`,
                cooldownMinutes,
                recentCancellations
            });
        }

        req.bookingCooldownInfo = {
            recentCancellations,
            cooldownMinutes
        };

        next();
    } catch (error) {
        console.error('Booking cooldown check error:', error);
        next(); // Don't block on error
    }
};

/**
 * Check for suspicious cancellation patterns
 * CRITICAL: Block new booking if last 5 were cancelled
 */
export const checkCancellationHistory = async (req, res, next) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return next();
        }

        // Get last 5 bookings
        const last5Bookings = await Booking.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('status');

        // Check if ALL last 5 bookings were cancelled
        const allCancelled = last5Bookings.length === 5 &&
            last5Bookings.every(b => b.status === 'cancelled');

        if (allCancelled) {
            logSecurityEvent({
                type: 'SUSPICIOUS_CANCELLATION_PATTERN',
                severity: SEVERITY.HIGH,
                userId,
                ip: req.ip,
                action: 'booking_creation_attempt',
                result: 'blocked',
                metadata: {
                    pattern: 'all_last_5_cancelled',
                    action_required: 'manual_review'
                }
            });

            return res.status(403).json({
                success: false,
                message: 'Your account has been flagged for review due to a high cancellation rate. Please contact support.',
                contactSupport: true
            });
        }

        // Check total cancellation rate
        const totalBookings = await Booking.countDocuments({ userId });
        const totalCancellations = await Booking.countDocuments({
            userId,
            status: 'cancelled'
        });

        const cancellationRate = totalBookings > 0 ? (totalCancellations / totalBookings) : 0;

        // Flag if >80% cancellation rate and >5 total bookings
        if (totalBookings >= 5 && cancellationRate > 0.8) {
            logSecurityEvent({
                type: 'HIGH_CANCELLATION_RATE',
                severity: SEVERITY.HIGH,
                userId,
                ip: req.ip,
                action: 'booking_creation_attempt',
                result: 'flagged',
                metadata: {
                    totalBookings,
                    totalCancellations,
                    cancellationRate: Math.round(cancellationRate * 100) + '%'
                }
            });

            // Don't block, but flag for monitoring
            req.highCancellationRate = true;
        }

        next();
    } catch (error) {
        console.error('Cancellation history check error:', error);
        next(); // Don't block on error
    }
};

/**
 * Combined booking abuse prevention middleware
 * Apply to booking creation routes
 */
export const preventBookingAbuse = [
    checkActiveBookingLimit,
    checkBookingCooldown,
    checkCancellationHistory
];

export default preventBookingAbuse;
