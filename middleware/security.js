import 'dotenv/config';

// reCAPTCHA configuration
// Use test keys in development (always passes)
const isDev = process.env.NODE_ENV !== 'production';
const RECAPTCHA_SECRET_KEY = isDev
    ? '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe' // Google test key
    : process.env.RECAPTCHA_SECRET_KEY;

// Progressive delay configuration (in seconds)
const DELAY_SCHEDULE = [0, 2, 4, 8, 16, 32]; // After each failed attempt

// In-memory store for failed attempts tracking
const failedAttemptsStore = new Map();

/**
 * Clean up old entries from failed attempts store
 */
function cleanupFailedAttempts() {
    const now = Date.now();
    const expiryTime = 30 * 60 * 1000; // 30 minutes
    for (const [key, value] of failedAttemptsStore) {
        if (now - value.lastAttempt > expiryTime) {
            failedAttemptsStore.delete(key);
        }
    }
}

// Run cleanup every 10 minutes
setInterval(cleanupFailedAttempts, 10 * 60 * 1000);

/**
 * Verify Google reCAPTCHA v3 token
 * In development mode with test keys, this always passes
 */
export const verifyCaptcha = async (req, res, next) => {
    // Skip captcha verification if explicitly disabled
    if (process.env.SKIP_CAPTCHA === 'true') {
        console.log('⚠️ Captcha verification skipped (SKIP_CAPTCHA=true)');
        return next();
    }

    const captchaToken = req.body.captchaToken || req.body.recaptchaToken;

    // In development, allow requests without captcha token
    if (isDev && !captchaToken) {
        console.log('⚠️ Development mode: Captcha token not provided, allowing request');
        return next();
    }

    if (!captchaToken) {
        return res.status(400).json({
            success: false,
            message: 'Captcha verification required'
        });
    }

    try {
        // Verify with Google reCAPTCHA API
        const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${RECAPTCHA_SECRET_KEY}&response=${captchaToken}`
        });

        const data = await response.json();

        if (!data.success) {
            console.log('❌ Captcha verification failed:', data['error-codes']);
            return res.status(400).json({
                success: false,
                message: 'Captcha verification failed. Please try again.'
            });
        }

        // For v3, check score (0.0 - 1.0, higher is more likely human)
        if (data.score !== undefined && data.score < 0.3) {
            console.log(`⚠️ Low captcha score: ${data.score}`);
            return res.status(400).json({
                success: false,
                message: 'Suspicious activity detected. Please try again.'
            });
        }

        console.log(`✅ Captcha verified (score: ${data.score || 'N/A'})`);
        req.captchaScore = data.score;
        next();
    } catch (error) {
        console.error('Captcha verification error:', error);

        // In development, allow on error
        if (isDev) {
            console.log('⚠️ Development mode: Captcha error, allowing request');
            return next();
        }

        return res.status(500).json({
            success: false,
            message: 'Captcha verification service unavailable'
        });
    }
};

/**
 * Validate and track device fingerprint
 * Helps identify repeat offenders across different emails/IPs
 */
export const validateFingerprint = (req, res, next) => {
    const fingerprint = req.body.fingerprint || req.headers['x-device-fingerprint'];

    // Store fingerprint in request for later use
    req.deviceFingerprint = fingerprint || 'unknown';

    // In production, you might want to block requests without fingerprints
    // For now, we just log and continue
    if (!fingerprint && process.env.NODE_ENV === 'production') {
        console.log('⚠️ Request without device fingerprint');
    }

    next();
};

/**
 * Progressive delay middleware
 * Adds exponential delay after failed attempts (2s, 4s, 8s, 16s, 32s)
 */
export const progressiveDelay = async (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const email = req.body.email?.toLowerCase() || 'unknown';
    const key = `delay:${ip}:${email}`;

    const entry = failedAttemptsStore.get(key);

    if (entry && entry.attempts > 0) {
        const delayIndex = Math.min(entry.attempts - 1, DELAY_SCHEDULE.length - 1);
        const delaySeconds = DELAY_SCHEDULE[delayIndex];

        if (delaySeconds > 0) {
            console.log(`⏳ Progressive delay: ${delaySeconds}s for ${email} (attempt ${entry.attempts + 1})`);

            // Add a slight artificial delay to slow down attackers
            await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        }
    }

    // Store reference for recording result
    req.progressiveDelayKey = key;
    req.recordFailedAttempt = () => recordFailedAttempt(key);
    req.resetFailedAttempts = () => resetFailedAttempts(key);

    next();
};

/**
 * Record a failed attempt
 */
function recordFailedAttempt(key) {
    const entry = failedAttemptsStore.get(key) || { attempts: 0, lastAttempt: Date.now() };
    entry.attempts += 1;
    entry.lastAttempt = Date.now();
    failedAttemptsStore.set(key, entry);
    console.log(`📝 Recorded failed attempt for ${key}: ${entry.attempts} total`);
}

/**
 * Reset failed attempts after successful action
 */
function resetFailedAttempts(key) {
    failedAttemptsStore.delete(key);
    console.log(`✅ Reset failed attempts for ${key}`);
}

/**
 * Sanitize and validate input
 * Basic XSS and injection prevention
 */
export const sanitizeInput = (req, res, next) => {
    // Sanitize string fields in body
    if (req.body) {
        for (const [key, value] of Object.entries(req.body)) {
            if (typeof value === 'string') {
                // Remove potential script tags and SQL injection patterns
                req.body[key] = value
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/['";]/g, '') // Remove quotes (basic SQL injection prevention)
                    .trim();
            }
        }
    }
    next();
};

/**
 * Get client IP address (handles proxies)
 */
export const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.ip
        || req.connection?.remoteAddress
        || 'unknown';
};

export default {
    verifyCaptcha,
    validateFingerprint,
    progressiveDelay,
    sanitizeInput,
    getClientIp
};
