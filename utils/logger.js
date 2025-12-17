/**
 * Secure Logger Utility
 * Masks PII and prevents sensitive data from being logged in production
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Mask email addresses - show first 2 chars and domain
 * Example: user@gmail.com -> us***@gmail.com
 */
function maskEmail(email) {
    if (!email || typeof email !== 'string') return email;
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const maskedLocal = local.length > 2
        ? local.substring(0, 2) + '***'
        : '***';
    return `${maskedLocal}@${domain}`;
}

/**
 * Mask phone numbers - show last 4 digits only
 * Example: +1234567890 -> ******7890
 */
function maskPhone(phone) {
    if (!phone || typeof phone !== 'string') return phone;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 4) return '****';
    return '******' + cleaned.slice(-4);
}

/**
 * Mask user object - removes or masks sensitive fields
 */
function maskUserObject(user) {
    if (!user) return user;

    const masked = { ...user };

    // Remove sensitive fields completely
    delete masked.password;
    delete masked.otpHash;
    delete masked.hashedPassword;

    // Mask PII
    if (masked.email) masked.email = maskEmail(masked.email);
    if (masked.phone) masked.phone = maskPhone(masked.phone);

    // Convert Mongoose document to plain object if needed
    if (masked._doc) {
        return maskUserObject(masked._doc);
    }

    return masked;
}

/**
 * Sanitize any data for logging - recursively masks sensitive info
 */
function sanitizeData(data) {
    if (!data) return data;

    // Handle arrays
    if (Array.isArray(data)) {
        return data.map(item => sanitizeData(item));
    }

    // Handle objects
    if (typeof data === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            // Skip these fields entirely
            if (['password', 'token', 'otp', 'secret', 'hashedPassword', 'otpHash'].includes(key)) {
                sanitized[key] = '[REDACTED]';
                continue;
            }

            // Mask email fields
            if (key.toLowerCase().includes('email') && typeof value === 'string') {
                sanitized[key] = maskEmail(value);
                continue;
            }

            // Mask phone fields
            if (key.toLowerCase().includes('phone') && typeof value === 'string') {
                sanitized[key] = maskPhone(value);
                continue;
            }

            // Recursively sanitize nested objects
            sanitized[key] = sanitizeData(value);
        }
        return sanitized;
    }

    return data;
}

/**
 * Safe logger - only logs in development, masks PII in production
 */
const logger = {
    /**
     * Log general info
     */
    info: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        } else {
            // In production, sanitize data
            const sanitized = args.map(arg =>
                typeof arg === 'object' ? sanitizeData(arg) : arg
            );
            console.log(...sanitized);
        }
    },

    /**
     * Log errors - always logged but sanitized
     */
    error: (...args) => {
        const sanitized = args.map(arg =>
            typeof arg === 'object' ? sanitizeData(arg) : arg
        );
        console.error(...sanitized);
    },

    /**
     * Log warnings
     */
    warn: (...args) => {
        const sanitized = args.map(arg =>
            typeof arg === 'object' ? sanitizeData(arg) : arg
        );
        console.warn(...sanitized);
    },

    /**
     * Development-only logging (completely silent in production)
     */
    dev: (...args) => {
        if (isDevelopment) {
            console.log('[DEV]', ...args);
        }
    },

    /**
     * NEVER log these - development warning only
     */
    dangerous: (message, sensitiveData) => {
        if (isDevelopment) {
            console.warn('⚠️ [SENSITIVE DATA - DEV ONLY]:', message);
            console.warn('   Data:', sensitiveData);
        }
        // In production: COMPLETE SILENCE
    },

    /**
     * User action logging (sanitized)
     */
    userAction: (action, userId, details = {}) => {
        const sanitized = sanitizeData(details);
        console.log(`👤 [${action}] User: ${userId}`, sanitized);
    }
};

// Export helpers for manual masking
export {
    maskEmail,
    maskPhone,
    maskUserObject,
    sanitizeData,
    isDevelopment
};

export default logger;
