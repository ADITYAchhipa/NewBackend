/**
 * State Machine Unit Tests
 * 
 * Run: npm test -- stateMachine.test.js
 */

import { describe, it, expect } from '@jest/globals';
import {
    BookingStates,
    DisputeStates,
    UserRoles,
    validateBookingTransition,
    validateDisputeTransition,
    getAllowedTransitions,
    isTerminalState
} from '../utils/stateMachine.js';

describe('State Machine - Booking Transitions', () => {

    describe('Same-State Rejection', () => {
        it('should reject same-state transitions', () => {
            const result = validateBookingTransition(
                BookingStates.PENDING,
                BookingStates.PENDING,
                UserRoles.USER
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Same-state transition not allowed');
        });
    });

    describe('Role-Based Access Control', () => {
        it('should allow user to confirm pending booking', () => {
            const result = validateBookingTransition(
                BookingStates.PENDING,
                BookingStates.CONFIRMED,
                UserRoles.USER
            );

            expect(result.valid).toBe(true);
        });

        it('should NOT allow user to complete confirmed booking', () => {
            const booking = { paymentStatus: 'paid' };
            const result = validateBookingTransition(
                BookingStates.CONFIRMED,
                BookingStates.COMPLETED,
                UserRoles.USER,
                booking
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain('not authorized');
        });

        it('should allow admin to complete confirmed booking', () => {
            const booking = { paymentStatus: 'paid' };
            const result = validateBookingTransition(
                BookingStates.CONFIRMED,
                BookingStates.COMPLETED,
                UserRoles.ADMIN,
                booking
            );

            expect(result.valid).toBe(true);
        });
    });

    describe('Precondition Guards', () => {
        it('should reject completion without payment', () => {
            const booking = { paymentStatus: 'pending' };
            const result = validateBookingTransition(
                BookingStates.CONFIRMED,
                BookingStates.COMPLETED,
                UserRoles.ADMIN,
                booking
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Precondition failed');
        });

        it('should allow completion with payment', () => {
            const booking = { paymentStatus: 'paid' };
            const result = validateBookingTransition(
                BookingStates.CONFIRMED,
                BookingStates.COMPLETED,
                UserRoles.ADMIN,
                booking
            );

            expect(result.valid).toBe(true);
        });

        it('should reject cancellation of completed booking', () => {
            const booking = { status: BookingStates.COMPLETED };
            const result = validateBookingTransition(
                BookingStates.COMPLETED,
                BookingStates.CANCELLED,
                UserRoles.ADMIN,
                booking
            );

            expect(result.valid).toBe(false);
        });
    });

    describe('Invalid Transitions', () => {
        it('should reject transition from completed to pending', () => {
            const result = validateBookingTransition(
                BookingStates.COMPLETED,
                BookingStates.PENDING,
                UserRoles.ADMIN
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid transition');
        });

        it('should reject transition from cancelled to confirmed', () => {
            const result = validateBookingTransition(
                BookingStates.CANCELLED,
                BookingStates.CONFIRMED,
                UserRoles.ADMIN
            );

            expect(result.valid).toBe(false);
        });
    });

    describe('Terminal States', () => {
        it('should identify completed as terminal', () => {
            expect(isTerminalState(BookingStates.COMPLETED, 'booking')).toBe(true);
        });

        it('should identify cancelled as terminal', () => {
            expect(isTerminalState(BookingStates.CANCELLED, 'booking')).toBe(true);
        });

        it('should identify pending as non-terminal', () => {
            expect(isTerminalState(BookingStates.PENDING, 'booking')).toBe(false);
        });
    });
});

describe('State Machine - Dispute Transitions', () => {

    describe('Admin-Only Transitions', () => {
        it('should NOT allow user to move dispute to under_review', () => {
            const result = validateDisputeTransition(
                DisputeStates.PENDING,
                DisputeStates.UNDER_REVIEW,
                UserRoles.USER
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain('not authorized');
        });

        it('should allow admin to move dispute to under_review', () => {
            const result = validateDisputeTransition(
                DisputeStates.PENDING,
                DisputeStates.UNDER_REVIEW,
                UserRoles.ADMIN
            );

            expect(result.valid).toBe(true);
        });
    });

    describe('Guard Validation', () => {
        it('should reject resolution without notes', () => {
            const dispute = { resolutionNotes: '' };
            const result = validateDisputeTransition(
                DisputeStates.UNDER_REVIEW,
                DisputeStates.RESOLVED,
                UserRoles.ADMIN,
                dispute
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Precondition failed');
        });

        it('should allow resolution with notes', () => {
            const dispute = { resolutionNotes: 'Resolved in favor of customer' };
            const result = validateDisputeTransition(
                DisputeStates.UNDER_REVIEW,
                DisputeStates.RESOLVED,
                UserRoles.ADMIN,
                dispute
            );

            expect(result.valid).toBe(true);
        });
    });
});

describe('State Machine - Helper Functions', () => {

    describe('getAllowedTransitions', () => {
        it('should return allowed transitions for pending booking', () => {
            const allowed = getAllowedTransitions(BookingStates.PENDING, 'booking');

            expect(allowed).toEqual(
                expect.arrayContaining([BookingStates.CONFIRMED, BookingStates.CANCELLED])
            );
        });

        it('should return empty array for terminal states', () => {
            const allowed = getAllowedTransitions(BookingStates.COMPLETED, 'booking');

            expect(allowed).toEqual([]);
        });
    });
});

describe('State Machine - Security', () => {

    describe('Immutability', () => {
        it('should not allow runtime mutation of transition maps', () => {
            // Try to mutate (should fail silently in non-strict mode, throw in strict)
            expect(() => {
                getAllowedTransitions(BookingStates.PENDING, 'booking').push('invalid');
            }).toThrow();
        });
    });
});
