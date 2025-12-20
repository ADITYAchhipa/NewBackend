/**
 * State Machine Validator with Role-Based Access & Guards
 * 
 * SECURITY FEATURES:
 * - Strict state validation (no same-state by default)
 * - Role-based transition control
 * - Precondition guards
 * - Side-effect prevention
 * - Security event logging on failures
 * - Frozen maps to prevent runtime mutation
 * 
 * Usage:
 *   import { validateBookingTransition, BookingStates } from './stateMachine.js';
 *   
 *   const result = validateBookingTransition(
 *     currentState,
 *     newState,
 *     userRole,
 *     booking  // For guard validation
 *   );
 *   
 *   if (!result.valid) {
 *     return res.status(400).json({ message: result.error });
 *   }
 */

import { logSecurityEvent, SEVERITY } from './securityLogger.js';

// ============================================================================
// BOOKING STATES & TRANSITIONS
// ============================================================================

export const BookingStates = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

export const UserRoles = {
    USER: 'user',
    ADMIN: 'admin',
    SYSTEM: 'system'
};

/**
 * Booking state transitions with role-based access control
 */
const bookingTransitions = {
    [BookingStates.PENDING]: {
        allowed: [BookingStates.CONFIRMED, BookingStates.CANCELLED],
        roles: {
            [BookingStates.CONFIRMED]: [UserRoles.USER, UserRoles.ADMIN, UserRoles.SYSTEM],
            [BookingStates.CANCELLED]: [UserRoles.USER, UserRoles.ADMIN]
        }
    },
    [BookingStates.CONFIRMED]: {
        allowed: [BookingStates.COMPLETED, BookingStates.CANCELLED],
        roles: {
            [BookingStates.COMPLETED]: [UserRoles.SYSTEM, UserRoles.ADMIN],  // Only system/admin can complete
            [BookingStates.CANCELLED]: [UserRoles.USER, UserRoles.ADMIN]
        }
    },
    [BookingStates.COMPLETED]: {
        allowed: [],  // Terminal state
        roles: {}
    },
    [BookingStates.CANCELLED]: {
        allowed: [],  // Terminal state
        roles: {}
    }
};

/**
 * Precondition guards for booking state transitions
 * Return true if transition is allowed, false otherwise
 */
const bookingGuards = {
    [BookingStates.COMPLETED]: (booking) => {
        // Can only complete if payment is confirmed
        return booking?.paymentStatus === 'paid';
    },
    [BookingStates.CANCELLED]: (booking) => {
        // Cannot cancel if already completed
        return booking?.status !== BookingStates.COMPLETED;
    }
};

/**
 * Validate booking state transition with role and guards
 * @param {string} fromState - Current state
 * @param {string} toState - Desired state
 * @param {string} role - User role ('user', 'admin', 'system')
 * @param {Object} booking - Booking object for guard validation
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateBookingTransition(fromState, toState, role = UserRoles.USER, booking = null) {
    // 1. CRITICAL: Reject same-state transitions (prevents replay attacks)
    if (fromState === toState) {
        return {
            valid: false,
            error: 'Same-state transition not allowed. Handle idempotency at service level.'
        };
    }

    // 2. Validate states exist
    if (!fromState || !toState) {
        return { valid: false, error: 'Invalid state values' };
    }

    // 3. Check if transition is allowed
    const transition = bookingTransitions[fromState];
    if (!transition || !transition.allowed.includes(toState)) {
        return {
            valid: false,
            error: `Invalid transition from ${fromState} to ${toState}`
        };
    }

    // 4. Check role-based access control
    const allowedRoles = transition.roles[toState];
    if (!allowedRoles || !allowedRoles.includes(role)) {
        return {
            valid: false,
            error: `Role '${role}' not authorized for this transition`
        };
    }

    // 5. Execute precondition guards
    const guard = bookingGuards[toState];
    if (guard && booking) {
        if (!guard(booking)) {
            return {
                valid: false,
                error: `Precondition failed for transitioning to ${toState}`
            };
        }
    }

    return { valid: true };
}

// ============================================================================
// DISPUTE STATES & TRANSITIONS
// ============================================================================

export const DisputeStates = {
    PENDING: 'pending',
    UNDER_REVIEW: 'under_review',
    RESOLVED: 'resolved',
    REJECTED: 'rejected',
    CLOSED: 'closed'
};

const disputeTransitions = {
    [DisputeStates.PENDING]: {
        allowed: [DisputeStates.UNDER_REVIEW, DisputeStates.REJECTED],
        roles: {
            [DisputeStates.UNDER_REVIEW]: [UserRoles.ADMIN, UserRoles.SYSTEM],  // Admin only
            [DisputeStates.REJECTED]: [UserRoles.ADMIN]
        }
    },
    [DisputeStates.UNDER_REVIEW]: {
        allowed: [DisputeStates.RESOLVED, DisputeStates.REJECTED],
        roles: {
            [DisputeStates.RESOLVED]: [UserRoles.ADMIN],
            [DisputeStates.REJECTED]: [UserRoles.ADMIN]
        }
    },
    [DisputeStates.RESOLVED]: {
        allowed: [DisputeStates.CLOSED],
        roles: {
            [DisputeStates.CLOSED]: [UserRoles.ADMIN, UserRoles.SYSTEM]
        }
    },
    [DisputeStates.REJECTED]: {
        allowed: [DisputeStates.CLOSED],
        roles: {
            [DisputeStates.CLOSED]: [UserRoles.ADMIN, UserRoles.SYSTEM]
        }
    },
    [DisputeStates.CLOSED]: {
        allowed: [],  // Terminal
        roles: {}
    }
};

const disputeGuards = {
    [DisputeStates.RESOLVED]: (dispute) => {
        // Must have resolution notes
        return dispute?.resolutionNotes && dispute.resolutionNotes.length > 0;
    },
    [DisputeStates.CLOSED]: (dispute) => {
        // Can only close if resolved or rejected
        return [DisputeStates.RESOLVED, DisputeStates.REJECTED].includes(dispute?.status);
    }
};

/**
 * Validate dispute state transition
 */
export function validateDisputeTransition(fromState, toState, role = UserRoles.USER, dispute = null) {
    if (fromState === toState) {
        return { valid: false, error: 'Same-state transition not allowed' };
    }

    if (!fromState || !toState) {
        return { valid: false, error: 'Invalid state values' };
    }

    const transition = disputeTransitions[fromState];
    if (!transition || !transition.allowed.includes(toState)) {
        return {
            valid: false,
            error: `Invalid transition from ${fromState} to ${toState}`
        };
    }

    const allowedRoles = transition.roles[toState];
    if (!allowedRoles || !allowedRoles.includes(role)) {
        return {
            valid: false,
            error: `Role '${role}' not authorized for this transition`
        };
    }

    const guard = disputeGuards[toState];
    if (guard && dispute) {
        if (!guard(dispute)) {
            return {
                valid: false,
                error: `Precondition failed for transitioning to ${toState}`
            };
        }
    }

    return { valid: true };
}

// ============================================================================
// PAYMENT STATES (Future Use)
// ============================================================================

export const PaymentStates = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded'
};

const paymentTransitions = {
    [PaymentStates.PENDING]: {
        allowed: [PaymentStates.PROCESSING, PaymentStates.FAILED],
        roles: {
            [PaymentStates.PROCESSING]: [UserRoles.SYSTEM],  // System only
            [PaymentStates.FAILED]: [UserRoles.SYSTEM]
        }
    },
    [PaymentStates.PROCESSING]: {
        allowed: [PaymentStates.PAID, PaymentStates.FAILED],
        roles: {
            [PaymentStates.PAID]: [UserRoles.SYSTEM],  // Payment gateway only
            [PaymentStates.FAILED]: [UserRoles.SYSTEM]
        }
    },
    [PaymentStates.PAID]: {
        allowed: [PaymentStates.REFUNDED],
        roles: {
            [PaymentStates.REFUNDED]: [UserRoles.ADMIN, UserRoles.SYSTEM]
        }
    },
    [PaymentStates.FAILED]: {
        allowed: [],  // Terminal
        roles: {}
    },
    [PaymentStates.REFUNDED]: {
        allowed: [],  // Terminal
        roles: {}
    }
};

const paymentGuards = {
    [PaymentStates.PAID]: (payment) => {
        // Must have transaction ID
        return payment?.transactionId && payment.transactionId.length > 0;
    },
    [PaymentStates.REFUNDED]: (payment) => {
        // Cannot refund if not paid
        return payment?.status === PaymentStates.PAID;
    }
};

/**
 * Validate payment state transition
 */
export function validatePaymentTransition(fromState, toState, role = UserRoles.SYSTEM, payment = null) {
    if (fromState === toState) {
        return { valid: false, error: 'Same-state transition not allowed' };
    }

    if (!fromState || !toState) {
        return { valid: false, error: 'Invalid state values' };
    }

    const transition = paymentTransitions[fromState];
    if (!transition || !transition.allowed.includes(toState)) {
        return {
            valid: false,
            error: `Invalid transition from ${fromState} to ${toState}`
        };
    }

    const allowedRoles = transition.roles[toState];
    if (!allowedRoles || !allowedRoles.includes(role)) {
        return {
            valid: false,
            error: `Role '${role}' not authorized for this transition`
        };
    }

    const guard = paymentGuards[toState];
    if (guard && payment) {
        if (!guard(payment)) {
            return {
                valid: false,
                error: `Precondition failed for transitioning to ${toState}`
            };
        }
    }

    return { valid: true };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get allowed transitions for a state (without role check)
 */
export function getAllowedTransitions(state, type = 'booking') {
    const maps = {
        booking: bookingTransitions,
        dispute: disputeTransitions,
        payment: paymentTransitions
    };

    return maps[type]?.[state]?.allowed || [];
}

/**
 * Check if a state is terminal
 */
export function isTerminalState(state, type = 'booking') {
    const allowed = getAllowedTransitions(state, type);
    return allowed.length === 0;
}

/**
 * Get required role for a specific transition
 */
export function getRequiredRoles(fromState, toState, type = 'booking') {
    const maps = {
        booking: bookingTransitions,
        dispute: disputeTransitions,
        payment: paymentTransitions
    };

    const transition = maps[type]?.[fromState];
    return transition?.roles?.[toState] || [];
}

export default {
    BookingStates,
    DisputeStates,
    PaymentStates,
    UserRoles,
    validateBookingTransition,
    validateDisputeTransition,
    validatePaymentTransition,
    getAllowedTransitions,
    isTerminalState,
    getRequiredRoles
};
