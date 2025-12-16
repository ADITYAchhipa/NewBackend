import Joi from 'joi';
import sanitizeHtml from 'sanitize-html';

// ============ CONFIGURATION ============

const CONFIG = {
    MAX_DEPTH: 10,           // Maximum object nesting depth
    MAX_STRING_LENGTH: 50000, // 50KB max string length
    MAX_ARRAY_LENGTH: 1000,   // Max array items
    LOG_BLOCKED: true         // Log blocked requests
};

// Security event log (in production, use proper logging service)
const securityLog = [];

/**
 * Log security event for monitoring
 */
const logSecurityEvent = (type, details, req) => {
    const event = {
        timestamp: new Date().toISOString(),
        type,
        ip: req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown',
        route: req?.originalUrl || 'unknown',
        method: req?.method || 'unknown',
        userAgent: req?.headers?.['user-agent']?.substring(0, 100) || 'unknown',
        details: typeof details === 'string' ? details : JSON.stringify(details).substring(0, 500)
    };

    if (CONFIG.LOG_BLOCKED) {
        console.log(`🚨 SECURITY [${event.type}] ${event.ip} ${event.method} ${event.route}: ${event.details}`);
    }

    // Keep last 1000 events in memory (in production, send to logging service)
    securityLog.push(event);
    if (securityLog.length > 1000) securityLog.shift();

    return event;
};

// ============ PROTOTYPE POLLUTION PROTECTION ============

const PROTOTYPE_POLLUTION_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Check for prototype pollution attempts
 */
const containsPrototypePollution = (obj, path = '', req = null) => {
    if (obj === null || obj === undefined) return false;

    if (typeof obj !== 'object') return false;

    if (Array.isArray(obj)) {
        return obj.some((item, index) => containsPrototypePollution(item, `${path}[${index}]`, req));
    }

    for (const [key, value] of Object.entries(obj)) {
        if (PROTOTYPE_POLLUTION_KEYS.includes(key)) {
            logSecurityEvent('PROTOTYPE_POLLUTION', `Key "${key}" at ${path}`, req);
            return true;
        }
        if (typeof value === 'object' && containsPrototypePollution(value, `${path}.${key}`, req)) {
            return true;
        }
    }

    return false;
};

// ============ NoSQL INJECTION PROTECTION ============

/**
 * Deep scan object for NoSQL injection patterns
 * FOCUSED ON OBJECT KEYS ONLY (not string values to avoid false positives)
 * Checks for:
 * - $ operators ($gt, $ne, $regex, etc.)
 * - Dots in keys (MongoDB dot-notation abuse)
 */
const containsNoSQLInjection = (obj, path = '', depth = 0, req = null) => {
    if (obj === null || obj === undefined) return false;

    // Depth limit check
    if (depth > CONFIG.MAX_DEPTH) {
        logSecurityEvent('DEPTH_LIMIT', `Max depth ${CONFIG.MAX_DEPTH} exceeded at ${path}`, req);
        return true;
    }

    // Skip strings - focus on object keys only to avoid false positives
    // (e.g., "$50 off" in a message would trigger if we check strings)
    if (typeof obj === 'string') return false;

    if (Array.isArray(obj)) {
        if (obj.length > CONFIG.MAX_ARRAY_LENGTH) {
            logSecurityEvent('ARRAY_LIMIT', `Array too large (${obj.length}) at ${path}`, req);
            return true;
        }
        return obj.some((item, index) => containsNoSQLInjection(item, `${path}[${index}]`, depth + 1, req));
    }

    if (typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
            // Check for MongoDB operators in keys (e.g., $gt, $ne, $regex)
            if (key.startsWith('$')) {
                logSecurityEvent('NOSQL_INJECTION', `Operator "${key}" at ${path}`, req);
                return true;
            }

            // Check for dots in keys - MongoDB treats these specially for nested field access
            // Attackers can abuse this: { "user.isAdmin": true } could bypass security
            if (key.includes('.')) {
                logSecurityEvent('NOSQL_INJECTION', `Dot in key "${key}" at ${path}`, req);
                return true;
            }

            // Recursively check nested objects
            if (containsNoSQLInjection(value, `${path}.${key}`, depth + 1, req)) {
                return true;
            }
        }
    }

    return false;
};

// ============ DEEP SANITIZATION ============

/**
 * Deep sanitize object with limits
 */
const deepSanitize = (obj, depth = 0, stripHtml = false) => {
    if (obj === null || obj === undefined) return obj;

    // Depth limit
    if (depth > CONFIG.MAX_DEPTH) return null;

    if (typeof obj === 'string') {
        // Length limit
        let str = obj.length > CONFIG.MAX_STRING_LENGTH
            ? obj.substring(0, CONFIG.MAX_STRING_LENGTH)
            : obj;

        // Sanitize HTML if requested (for long text fields)
        if (stripHtml) {
            str = sanitizeHtml(str, {
                allowedTags: [],      // Strip all HTML
                allowedAttributes: {}
            });
        } else {
            // Basic cleanup
            str = str
                .replace(/\0/g, '')                    // Remove null bytes
                .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
                .trim();
        }

        return str;
    }

    if (Array.isArray(obj)) {
        // Limit array length
        const limited = obj.slice(0, CONFIG.MAX_ARRAY_LENGTH);
        return limited.map(item => deepSanitize(item, depth + 1, stripHtml));
    }

    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            // Skip dangerous keys
            if (key.startsWith('$') || PROTOTYPE_POLLUTION_KEYS.includes(key)) {
                continue;
            }
            sanitized[key] = deepSanitize(value, depth + 1, stripHtml);
        }
        return sanitized;
    }

    return obj;
};

/**
 * Sanitize long text fields (reviews, feedback, descriptions)
 * Allows safe HTML and strips dangerous content
 */
const sanitizeLongText = (text) => {
    if (typeof text !== 'string') return text;

    return sanitizeHtml(text, {
        allowedTags: ['b', 'i', 'em', 'strong', 'br', 'p'],
        allowedAttributes: {},
        disallowedTagsMode: 'discard'
    });
};

// ============ VALIDATION SCHEMAS ============

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const schemas = {
    // User Registration
    registration: Joi.object({
        name: Joi.string().min(2).max(100).required()
            .messages({
                'string.min': 'Name must be at least 2 characters',
                'string.max': 'Name cannot exceed 100 characters',
                'any.required': 'Name is required'
            }),
        email: Joi.string().email().lowercase().trim().max(254).required()
            .messages({
                'string.email': 'Please provide a valid email address',
                'any.required': 'Email is required'
            }),
        password: Joi.string().min(6).max(128).required()
            .messages({
                'string.min': 'Password must be at least 6 characters',
                'any.required': 'Password is required'
            }),
        phone: Joi.string().pattern(/^[+]?[\d\s-]{8,20}$/).required()
            .messages({
                'string.pattern.base': 'Please provide a valid phone number',
                'any.required': 'Phone number is required'
            }),
        referralCode: Joi.string().max(50).optional().allow(''),
        fingerprint: Joi.string().max(500).optional(),
        captchaToken: Joi.string().max(2000).optional(),
        recaptchaToken: Joi.string().max(2000).optional()
    }),

    // User Login
    login: Joi.object({
        email: Joi.string().email().lowercase().trim().max(254).required()
            .messages({
                'string.email': 'Please provide a valid email address',
                'any.required': 'Email is required'
            }),
        password: Joi.string().max(128).required()
            .messages({
                'any.required': 'Password is required'
            }),
        fingerprint: Joi.string().max(500).optional(),
        captchaToken: Joi.string().max(2000).optional(),
        recaptchaToken: Joi.string().max(2000).optional()
    }),

    // Email only (forgot password)
    email: Joi.object({
        email: Joi.string().email().lowercase().trim().max(254).required()
            .messages({
                'string.email': 'Please provide a valid email address',
                'any.required': 'Email is required'
            })
    }),

    // Password Reset
    passwordReset: Joi.object({
        email: Joi.string().email().lowercase().trim().max(254).required(),
        otp: Joi.string().length(6).pattern(/^\d+$/).required()
            .messages({
                'string.length': 'OTP must be 6 digits',
                'string.pattern.base': 'OTP must contain only numbers'
            }),
        newPassword: Joi.string().min(6).max(128).required()
            .messages({
                'string.min': 'Password must be at least 6 characters'
            }),
        resetToken: Joi.string().max(1000).required()
    }),

    // OTP Verification
    otpVerification: Joi.object({
        otp: Joi.string().length(6).pattern(/^\d+$/).required()
            .messages({
                'string.length': 'OTP must be 6 digits',
                'string.pattern.base': 'OTP must contain only numbers'
            }),
        registrationToken: Joi.string().max(1000).required()
    }),

    // Feedback submission
    feedback: Joi.object({
        category: Joi.string().valid('General', 'Bug Report', 'Feature Request', 'Support', 'Other').required()
            .messages({
                'any.only': 'Category must be one of: General, Bug Report, Feature Request, Support, Other',
                'any.required': 'Category is required'
            }),
        rating: Joi.number().integer().min(1).max(5).required()
            .messages({
                'number.min': 'Rating must be at least 1',
                'number.max': 'Rating cannot exceed 5',
                'any.required': 'Rating is required'
            }),
        message: Joi.string().min(10).max(5000).required()
            .messages({
                'string.min': 'Feedback message must be at least 10 characters',
                'string.max': 'Feedback message cannot exceed 5000 characters',
                'any.required': 'Feedback message is required'
            })
    }),

    // Review submission
    review: Joi.object({
        type: Joi.string().valid('property', 'vehicle').required()
            .messages({
                'any.only': 'Type must be either "property" or "vehicle"',
                'any.required': 'Type is required'
            }),
        itemId: Joi.string().pattern(objectIdPattern).required()
            .messages({
                'string.pattern.base': 'Invalid item ID format',
                'any.required': 'Item ID is required'
            }),
        rating: Joi.number().integer().min(1).max(5).required()
            .messages({
                'number.min': 'Rating must be at least 1',
                'number.max': 'Rating cannot exceed 5',
                'any.required': 'Rating is required'
            }),
        comment: Joi.string().min(10).max(5000).required()
            .messages({
                'string.min': 'Review must be at least 10 characters',
                'string.max': 'Review cannot exceed 5000 characters',
                'any.required': 'Review comment is required'
            }),
        detailedRatings: Joi.object().optional(),
        images: Joi.array().items(Joi.string().uri().max(500)).max(10).optional()
    }),

    // Review update
    reviewUpdate: Joi.object({
        rating: Joi.number().integer().min(1).max(5).optional(),
        comment: Joi.string().min(10).max(5000).optional(),
        detailedRatings: Joi.object().optional(),
        images: Joi.array().items(Joi.string().uri().max(500)).max(10).optional()
    }),

    // ObjectId parameter validation
    objectId: Joi.object({
        id: Joi.string().pattern(objectIdPattern).required()
            .messages({ 'string.pattern.base': 'Invalid ID format' })
    }),

    // Chat message
    chatMessage: Joi.object({
        receiverId: Joi.string().pattern(objectIdPattern).required(),
        message: Joi.string().min(1).max(5000).required()
            .messages({
                'string.min': 'Message cannot be empty',
                'string.max': 'Message cannot exceed 5000 characters'
            })
    }),

    // Dispute submission
    dispute: Joi.object({
        bookingId: Joi.string().pattern(objectIdPattern).required(),
        reason: Joi.string().min(10).max(5000).required(),
        evidence: Joi.array().items(Joi.string().uri().max(500)).max(10).optional()
    })
};

// ============ MIDDLEWARE FUNCTIONS ============

/**
 * Combined security check middleware
 * Checks: NoSQL injection, Prototype pollution, Depth limits
 */
export const preventNoSQLInjection = (req, res, next) => {
    const sources = [
        { name: 'body', data: req.body },
        { name: 'query', data: req.query },
        { name: 'params', data: req.params }
    ];

    for (const source of sources) {
        // Check prototype pollution
        if (containsPrototypePollution(source.data, source.name, req)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request: potentially malicious input detected'
            });
        }

        // Check NoSQL injection
        if (containsNoSQLInjection(source.data, source.name, 0, req)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request: potentially malicious input detected'
            });
        }
    }

    next();
};

/**
 * Deep Sanitization Middleware
 * Note: In Express 5, req.query may be read-only, so we only sanitize req.body
 */
export const sanitizeRequest = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        try {
            req.body = deepSanitize(req.body, 0, false);
        } catch (e) {
            // If body is frozen/read-only, continue anyway
            console.log('⚠️ Could not sanitize body:', e.message);
        }
    }
    // Note: req.query in Express 5 is read-only, skip direct modification
    // Query params are sanitized by express-mongo-sanitize at server level
    next();
};

/**
 * HTML Sanitization Middleware for long text fields
 * Use on routes that accept user-generated content
 */
export const sanitizeHtmlContent = (fields = ['message', 'comment', 'description']) => {
    return (req, res, next) => {
        if (req.body) {
            for (const field of fields) {
                if (req.body[field] && typeof req.body[field] === 'string') {
                    req.body[field] = sanitizeLongText(req.body[field]);
                }
            }
        }
        next();
    };
};

/**
 * Create validation middleware for a specific schema
 */
const validate = (schemaName, source = 'body') => {
    return (req, res, next) => {
        const schema = schemas[schemaName];
        if (!schema) {
            console.error(`Validation schema '${schemaName}' not found`);
            return next();
        }

        const dataToValidate = req[source];
        const { error, value } = schema.validate(dataToValidate, {
            abortEarly: false,
            stripUnknown: true // CRITICAL: Remove unknown fields (mass assignment protection)
        });

        if (error) {
            const messages = error.details.map(d => d.message);
            logSecurityEvent('VALIDATION_FAILED', messages.join(', '), req);
            return res.status(400).json({
                success: false,
                message: messages[0],
                errors: messages
            });
        }

        req[source] = value;
        next();
    };
};

// Export named validators
export const validateRegistration = validate('registration');
export const validateLogin = validate('login');
export const validateEmail = validate('email');
export const validatePasswordReset = validate('passwordReset');
export const validateOtpVerification = validate('otpVerification');
export const validateFeedback = validate('feedback');
export const validateReview = validate('review');
export const validateReviewUpdate = validate('reviewUpdate');
export const validateObjectId = validate('objectId', 'params');
export const validateChatMessage = validate('chatMessage');
export const validateDispute = validate('dispute');

// Export utilities and monitoring
export {
    containsNoSQLInjection,
    containsPrototypePollution,
    deepSanitize,
    sanitizeLongText,
    schemas,
    securityLog,
    logSecurityEvent,
    CONFIG
};

export default {
    preventNoSQLInjection,
    sanitizeRequest,
    sanitizeHtmlContent,
    validateRegistration,
    validateLogin,
    validateEmail,
    validatePasswordReset,
    validateOtpVerification,
    validateFeedback,
    validateReview,
    validateReviewUpdate,
    validateObjectId,
    validateChatMessage,
    validateDispute
};
