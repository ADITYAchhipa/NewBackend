import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

// Configuration
const OTP_RATE_LIMIT_PER_HOUR = parseInt(process.env.OTP_RATE_LIMIT_PER_HOUR) || 3;
const LOGIN_RATE_LIMIT_PER_15MIN = 5;
const GENERAL_RATE_LIMIT_PER_MIN = 100;

// In-memory store for fast rate limiting (no MongoDB - stateless approach)
const memoryStore = new Map();

/**
 * Clean up expired entries from memory store
 */
function cleanupMemoryStore() {
    const now = Date.now();
    for (const [key, value] of memoryStore) {
        if (value.expiresAt < now) {
            memoryStore.delete(key);
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupMemoryStore, 5 * 60 * 1000);

/**
 * Check rate limit using in-memory storage only (no database)
 * @param {string} identifier - Email or IP
 * @param {string} type - Type of rate limit
 * @param {number} maxCount - Maximum allowed count
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{allowed: boolean, remaining: number, resetAt: Date, count: number}}
 */
function checkRateLimit(identifier, type, maxCount, windowMs) {
    const key = `${type}:${identifier}`;
    const now = Date.now();

    let entry = memoryStore.get(key);

    // Clean up expired entry
    if (entry && entry.expiresAt < now) {
        memoryStore.delete(key);
        entry = null;
    }

    if (!entry) {
        // Create new rate limit entry
        const expiresAt = now + windowMs;
        memoryStore.set(key, { count: 1, expiresAt });

        return {
            allowed: true,
            remaining: maxCount - 1,
            resetAt: new Date(expiresAt),
            count: 1
        };
    }

    // Check if limit exceeded
    if (entry.count >= maxCount) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: new Date(entry.expiresAt),
            count: entry.count
        };
    }

    // Increment count
    entry.count += 1;
    memoryStore.set(key, entry);

    return {
        allowed: true,
        remaining: maxCount - entry.count,
        resetAt: new Date(entry.expiresAt),
        count: entry.count
    };
}

/**
 * Create a signed rate limit token (JWT-based, stored in response)
 * This allows client-side rate limit tracking without database storage
 */
function createRateLimitToken(email, count, expiresAt) {
    return jwt.sign(
        { email, count, expiresAt: expiresAt.getTime() },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );
}

/**
 * Verify and extract rate limit info from token
 */
function verifyRateLimitToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.expiresAt < Date.now()) {
            return null; // Token expired
        }
        return decoded;
    } catch {
        return null;
    }
}

/**
 * OTP Request Rate Limiter Middleware
 * Uses hybrid: in-memory + JWT token tracking
 * Limits: 3 OTP requests per hour per email
 */
export const otpRateLimiter = async (req, res, next) => {
    const email = req.body.email?.toLowerCase()?.trim();
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';

    if (!email) {
        return res.status(400).json({
            success: false,
            message: 'Email is required'
        });
    }

    // Check for rate limit token in cookies or headers
    const rateLimitToken = req.cookies?.otp_rate_limit || req.headers['x-otp-rate-limit'];
    let tokenInfo = rateLimitToken ? verifyRateLimitToken(rateLimitToken) : null;

    // Combine token info with in-memory check for defense in depth
    // This prevents bypassing by deleting cookies
    const memoryLimit = checkRateLimit(email, 'otp_request', OTP_RATE_LIMIT_PER_HOUR, 60 * 60 * 1000);

    // Use the higher count between token and memory
    let currentCount = memoryLimit.count;
    if (tokenInfo && tokenInfo.email === email) {
        currentCount = Math.max(currentCount, tokenInfo.count);
    }

    if (currentCount > OTP_RATE_LIMIT_PER_HOUR) {
        const minutesRemaining = Math.ceil((memoryLimit.resetAt - Date.now()) / 60000);
        console.log(`⚠️ OTP rate limit exceeded for ${email} (count: ${currentCount})`);
        return res.status(429).json({
            success: false,
            message: `Too many OTP requests. Please try again in ${minutesRemaining} minutes.`,
            retryAfter: memoryLimit.resetAt
        });
    }

    // Also check IP-based limit (10 requests per hour per IP for OTP)
    const ipLimit = checkRateLimit(ip, 'otp_request_ip', 10, 60 * 60 * 1000);

    if (!ipLimit.allowed) {
        console.log(`⚠️ OTP IP rate limit exceeded for ${ip}`);
        return res.status(429).json({
            success: false,
            message: 'Too many requests from this location. Please try again later.',
            retryAfter: ipLimit.resetAt
        });
    }

    // Create updated rate limit token
    const newToken = createRateLimitToken(email, currentCount, memoryLimit.resetAt);

    // Set rate limit cookie (helps track across requests)
    res.cookie('otp_rate_limit', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 60 * 60 * 1000 // 1 hour
    });

    // Attach rate limit info to request
    req.rateLimitInfo = {
        count: currentCount,
        remaining: OTP_RATE_LIMIT_PER_HOUR - currentCount,
        resetAt: memoryLimit.resetAt
    };

    next();
};

/**
 * Login Rate Limiter Middleware
 * Uses in-memory storage only
 * Limits: 5 login attempts per 15 minutes per IP
 */
export const loginRateLimiter = async (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const email = req.body.email?.toLowerCase()?.trim();

    // Check IP-based limit
    const ipLimit = checkRateLimit(ip, 'login_attempt', LOGIN_RATE_LIMIT_PER_15MIN, 15 * 60 * 1000);

    if (!ipLimit.allowed) {
        const minutesRemaining = Math.ceil((ipLimit.resetAt - Date.now()) / 60000);
        console.log(`⚠️ Login rate limit exceeded for IP ${ip}`);
        return res.status(429).json({
            success: false,
            message: `Too many login attempts. Please try again in ${minutesRemaining} minutes.`,
            retryAfter: ipLimit.resetAt
        });
    }

    // Also limit by email if provided (more aggressive)
    if (email) {
        const emailLimit = checkRateLimit(email, 'login_attempt_email', 10, 15 * 60 * 1000);

        if (!emailLimit.allowed) {
            console.log(`⚠️ Login rate limit exceeded for ${email}`);
            return res.status(429).json({
                success: false,
                message: 'This account has been temporarily locked due to too many login attempts.',
                retryAfter: emailLimit.resetAt
            });
        }
    }

    req.loginRateLimitInfo = ipLimit;
    next();
};

/**
 * General API Rate Limiter
 * Uses express-rate-limit for in-memory limiting
 */
export const generalRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: GENERAL_RATE_LIMIT_PER_MIN,
    message: {
        success: false,
        message: 'Too many requests. Please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Disable IPv6 validation warning - we handle IPs our own way
    validate: { xForwardedForHeader: false }
});

/**
 * Reset rate limit for an identifier (call after successful action)
 */
export function resetRateLimit(identifier, type) {
    const key = `${type}:${identifier}`;
    memoryStore.delete(key);
}

export default {
    otpRateLimiter,
    loginRateLimiter,
    generalRateLimiter,
    checkRateLimit,
    resetRateLimit
};
