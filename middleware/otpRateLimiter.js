/**
 * Global OTP Rate Limiter
 * Prevents distributed brute-force attacks on OTP verification
 * Tracks attempts by IP and device fingerprint across all registration sessions
 */

// In-memory store for OTP attempts (in production, use Redis)
const otpAttemptsStore = new Map();

// Configuration
const OTP_LIMITS = {
    MAX_PER_IP_HOURLY: 10,      // Max OTP requests per IP per hour
    MAX_PER_FINGERPRINT_HOURLY: 10, // Max OTP requests per fingerprint per hour
    CLEANUP_INTERVAL: 10 * 60 * 1000, // Cleanup every 10 minutes
    WINDOW_MS: 60 * 60 * 1000   // 1 hour window
};

/**
 * Clean up expired entries
 */
function cleanupOtpAttempts() {
    const now = Date.now();
    for (const [key, data] of otpAttemptsStore) {
        if (now - data.firstAttempt > OTP_LIMITS.WINDOW_MS) {
            otpAttemptsStore.delete(key);
        }
    }
}

// Run cleanup periodically
setInterval(cleanupOtpAttempts, OTP_LIMITS.CLEANUP_INTERVAL);

/**
 * Get client IP address
 */
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.ip
        || req.connection?.remoteAddress
        || 'unknown';
}

/**
 * Record OTP attempt
 */
function recordOtpAttempt(key) {
    const now = Date.now();
    const existing = otpAttemptsStore.get(key);

    if (!existing) {
        otpAttemptsStore.set(key, {
            count: 1,
            firstAttempt: now,
            lastAttempt: now
        });
        return 1;
    }

    // Reset if window expired
    if (now - existing.firstAttempt > OTP_LIMITS.WINDOW_MS) {
        otpAttemptsStore.set(key, {
            count: 1,
            firstAttempt: now,
            lastAttempt: now
        });
        return 1;
    }

    // Increment count
    existing.count += 1;
    existing.lastAttempt = now;
    return existing.count;
}

/**
 * Get current attempt count
 */
function getOtpAttemptCount(key) {
    const existing = otpAttemptsStore.get(key);
    if (!existing) return 0;

    const now = Date.now();
    // Check if window expired
    if (now - existing.firstAttempt > OTP_LIMITS.WINDOW_MS) {
        otpAttemptsStore.delete(key);
        return 0;
    }

    return existing.count;
}

/**
 * Global OTP Rate Limiter Middleware
 * Apply to OTP request endpoints
 */
export const globalOtpRateLimiter = (req, res, next) => {
    const ip = getClientIp(req);
    const fingerprint = req.body.fingerprint || req.headers['x-device-fingerprint'] || 'unknown';

    const ipKey = `otp:ip:${ip}`;
    const fpKey = `otp:fp:${fingerprint}`;

    const ipCount = getOtpAttemptCount(ipKey);
    const fpCount = getOtpAttemptCount(fpKey);

    // Check IP limit
    if (ipCount >= OTP_LIMITS.MAX_PER_IP_HOURLY) {
        console.log(`🚨 OTP rate limit exceeded for IP: ${ip} (${ipCount} requests)`);
        return res.status(429).json({
            success: false,
            message: "Too many OTP requests. Please try again in an hour."
        });
    }

    // Check fingerprint limit
    if (fpCount >= OTP_LIMITS.MAX_PER_FINGERPRINT_HOURLY) {
        console.log(`🚨 OTP rate limit exceeded for fingerprint: ${fingerprint} (${fpCount} requests)`);
        return res.status(429).json({
            success: false,
            message: "Too many OTP requests from this device. Please try again in an hour."
        });
    }

    // Record attempts
    recordOtpAttempt(ipKey);
    recordOtpAttempt(fpKey);

    console.log(`✅ OTP request allowed - IP: ${ip} (${ipCount + 1}/${OTP_LIMITS.MAX_PER_IP_HOURLY}), FP: ${fingerprint.substring(0, 8)}... (${fpCount + 1}/${OTP_LIMITS.MAX_PER_FINGERPRINT_HOURLY})`);

    next();
};

export default {
    globalOtpRateLimiter,
    OTP_LIMITS
};
