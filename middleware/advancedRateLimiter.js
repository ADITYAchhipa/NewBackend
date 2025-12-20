/**
 * Advanced Rate Limiters - Granular per-endpoint protection
 * 
 * Features:
 * - IP + userId combined limiting
 * - Burst protection (per-second micro limits)
 * - Different limits per endpoint type
 * - Logged-in users also rate limited
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Create rate limiter with IP + userId key generation
 */
const createLimiter = (config) => {
    return rateLimit({
        windowMs: config.windowMs,
        max: config.max,
        message: {
            success: false,
            message: config.message || 'Too many requests, please try again later'
        },
        standardHeaders: true,
        legacyHeaders: false,
        // CRITICAL: Combine IP + userId for authenticated users
        // Use ipKeyGenerator for proper IPv6 normalization
        keyGenerator: (req) => {
            if (req.userId) {
                return `user_${req.userId}`;  // Authenticated user
            }
            // Use ipKeyGenerator helper to properly normalize IPv6 addresses
            // This prevents IPv6 users from bypassing limits by using different representations
            return ipKeyGenerator(req);
        },
        // Skip successful requests from counting (optional)
        skipSuccessfulRequests: config.skipSuccessfulRequests || false,
        // Skip failed requests (don't count 4xx/5xx responses)
        skipFailedRequests: config.skipFailedRequests || false
    });
};

// ============================================================================
// AUTH ENDPOINTS - STRICT (Brute-force prevention)
// ============================================================================

export const authLimiter = createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per 15 min
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    skipSuccessfulRequests: false // Count all auth attempts
});

// Login - Even stricter
export const loginLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5, // 5 login attempts per 15 min
    message: 'Too many login attempts. Please try again later.'
});

// ============================================================================
// SEARCH ENDPOINTS - MODERATE (Scraping prevention)
// ============================================================================

export const searchLimiter = createLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 searches per minute
    message: 'Search rate limit exceeded. Please slow down.'
});

// Burst protection for search (per-second limit)
export const searchBurstLimiter = createLimiter({
    windowMs: 1000, // 1 second
    max: 5, // Max 5 searches per second
    message: 'Too many requests. Please wait a moment.'
});

// ============================================================================
// RECOMMENDATIONS - LOW (CPU-intensive protection)
// ============================================================================

export const recommendationLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: 15, // 15 recommendation requests per minute
    message: 'Too many recommendation requests. Please try again shortly.'
});

// Burst protection
export const recommendationBurstLimiter = createLimiter({
    windowMs: 1000,
    max: 2, // Max 2 per second
    message: 'Please wait before requesting more recommendations.'
});

// ============================================================================
// WRITE OPERATIONS - STRICT (DB abuse prevention)
// ============================================================================

// General write operations (favourites, visited, etc.)
export const writeLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: 30, // 30 writes per minute
    message: 'Too many requests. Please slow down.'
});

// Burst protection for writes
export const writeBurstLimiter = createLimiter({
    windowMs: 1000,
    max: 3, // Max 3 writes per second
    message: 'Too many rapid requests. Please wait.'
});

// ============================================================================
// REVIEWS - STRICT (Spam prevention)
// ============================================================================

export const reviewLimiter = createLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // 5 reviews per 5 minutes
    message: 'Too many review submissions. Please wait before submitting another.'
});

// ============================================================================
// DISPUTES - VERY STRICT (Abuse prevention)
// ============================================================================

export const disputeLimiter = createLimiter({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 3, // 3 disputes per 10 minutes
    message: 'Too many dispute submissions. Please wait before creating another.'
});

// ============================================================================
// FILE UPLOADS - VERY STRICT (Storage/bandwidth protection)
// ============================================================================

export const uploadLimiter = createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 uploads per hour
    message: 'Upload limit exceeded. Please try again later.'
});

// ============================================================================
// READ-ONLY - HIGHER LIMIT (But still capped)
// ============================================================================

export const readLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: 100, // 100 reads per minute
    message: 'Too many requests. Please slow down.'
});

// ============================================================================
// COMBINED MIDDLEWARE - Apply burst + regular limits together
// ============================================================================

/**
 * Apply both burst and regular rate limits
 * Usage: router.get('/search', ...applyRateLimits(searchBurstLimiter, searchLimiter), handler)
 */
export const applyRateLimits = (...limiters) => {
    return limiters;
};

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
    authLimiter,
    loginLimiter,
    searchLimiter,
    searchBurstLimiter,
    recommendationLimiter,
    recommendationBurstLimiter,
    writeLimiter,
    writeBurstLimiter,
    reviewLimiter,
    disputeLimiter,
    uploadLimiter,
    readLimiter,
    applyRateLimits
};
