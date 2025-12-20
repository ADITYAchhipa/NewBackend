/**
 * Security Event Logger
 * Structured logging for security events with severity levels
 * 
 * Usage:
 *   import { logSecurityEvent, SEVERITY } from './securityLogger.js';
 *   
 *   logSecurityEvent({
 *     type: 'AUTH_FAILURE',
 *     severity: SEVERITY.MEDIUM,
 *     userId: req.userId,
 *     ip: req.ip,
 *     action: 'login_attempt',
 *     result: 'blocked',
 *     metadata: { reason: 'invalid_password', attempts: 3 }
 *   });
 */

import 'dotenv/config';

// Severity levels
export const SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

// Event types
export const EVENT_TYPE = {
    AUTH_FAILURE: 'auth_failure',
    AUTH_SUCCESS: 'auth_success',
    PROTOTYPE_POLLUTION: 'prototype_pollution',
    OWNERSHIP_VIOLATION: 'ownership_violation',
    STATE_VIOLATION: 'state_violation',
    RATE_LIMIT: 'rate_limit_exceeded',
    CSRF_FAILURE: 'csrf_token_invalid',
    SUSPICIOUS_FILE: 'suspicious_file_upload',
    ADMIN_ACTION: 'admin_action',
    DATA_ACCESS: 'data_access_attempt'
};

/**
 * Log a security event
 */
export const logSecurityEvent = (event) => {
    try {
        const logEntry = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            type: event.type || 'UNKNOWN',
            severity: event.severity || SEVERITY.LOW,
            userId: event.userId || 'anonymous',
            ip: event.ip || 'unknown',
            action: event.action,
            resource: event.resource,
            result: event.result, // 'success', 'failure', 'blocked'
            metadata: sanitizeMetadata(event.metadata || {})
        };

        // Format log message
        const logMessage = formatLogMessage(logEntry);

        // Log based on severity
        if (event.severity === SEVERITY.CRITICAL) {
            console.error('🚨 SECURITY [CRITICAL]:', logMessage);
            // In production: Send alert to monitoring service (e.g., Sentry, DataDog)
            // sendAlertToMonitoring(logEntry);
        } else if (event.severity === SEVERITY.HIGH) {
            console.warn('⚠️  SECURITY [HIGH]:', logMessage);
        } else if (event.severity === SEVERITY.MEDIUM) {
            console.log('🔒 SECURITY [MEDIUM]:', logMessage);
        } else {
            console.log('ℹ️  SECURITY [LOW]:', logMessage);
        }

        // In production: Send to log aggregation service
        // sendToLogAggregator(logEntry);

    } catch (error) {
        // Never throw in logging - fail silently
        console.error('Security logger error:', error.message);
    }
};

/**
 * Format log message for readability
 */
function formatLogMessage(entry) {
    return JSON.stringify({
        time: entry.timestamp,
        type: entry.type,
        user: entry.userId,
        ip: entry.ip,
        action: entry.action,
        result: entry.result,
        meta: entry.metadata
    });
}

/**
 * Sanitize metadata to prevent logging sensitive data
 */
function sanitizeMetadata(metadata) {
    const sanitized = { ...metadata };

    // Remove sensitive fields
    const sensitiveKeys = [
        'password',
        'token',
        'secret',
        'apiKey',
        'creditCard',
        'ssn',
        'authorization'
    ];

    for (const key of sensitiveKeys) {
        if (key in sanitized) {
            sanitized[key] = '[REDACTED]';
        }
    }

    // Truncate long strings
    for (const key in sanitized) {
        if (typeof sanitized[key] === 'string' && sanitized[key].length > 500) {
            sanitized[key] = sanitized[key].substring(0, 500) + '... [truncated]';
        }
    }

    return sanitized;
}

/**
 * Helper: Log authentication event
 */
export const logAuthEvent = (userId, action, result, metadata = {}) => {
    logSecurityEvent({
        type: result === 'success' ? EVENT_TYPE.AUTH_SUCCESS : EVENT_TYPE.AUTH_FAILURE,
        severity: result === 'failure' ? SEVERITY.MEDIUM : SEVERITY.LOW,
        userId,
        action,
        result,
        metadata
    });
};

/**
 * Helper: Log access control violation
 */
export const logAccessViolation = (userId, resource, action, metadata = {}) => {
    logSecurityEvent({
        type: EVENT_TYPE.OWNERSHIP_VIOLATION,
        severity: SEVERITY.HIGH,
        userId,
        action,
        resource,
        result: 'blocked',
        metadata
    });
};

export default logSecurityEvent;
