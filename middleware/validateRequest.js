/**
 * Request Validation Middleware using Zod
 * Enforces strict type checking and schema validation
 */

import { z } from 'zod';

/**
 * Validate query parameters against a Zod schema
 */
export const validateQuery = (schema) => {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.query);

            if (!result.success) {
                const errors = result.error.issues.map(issue => ({
                    field: issue.path.join('.') || 'query',
                    message: issue.message,
                    received: issue.received
                }));

                return res.status(400).json({
                    success: false,
                    message: 'Invalid query parameters',
                    errors
                });
            }

            // Replace req.query with validated data
            req.query = result.data;
            next();
        } catch (error) {
            console.error('Query validation error:', error);
            return res.status(500).json({
                success: false,
                message: 'Validation error'
            });
        }
    };
};

/**
 * Validate request body against a Zod schema
 */
export const validateBody = (schema) => {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.body);

            if (!result.success) {
                const errors = result.error.issues.map(issue => ({
                    field: issue.path.join('.') || 'body',
                    message: issue.message,
                    received: issue.received
                }));

                return res.status(400).json({
                    success: false,
                    message: 'Invalid request body',
                    errors
                });
            }

            // Replace req.body with validated data
            req.body = result.data;
            next();
        } catch (error) {
            console.error('Body validation error:', error);
            return res.status(500).json({
                success: false,
                message: 'Validation error'
            });
        }
    };
};

/**
 * Validate route parameters against a Zod schema
 */
export const validateParams = (schema) => {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.params);

            if (!result.success) {
                const errors = result.error.issues.map(issue => ({
                    field: issue.path.join('.') || 'params',
                    message: issue.message,
                    received: issue.received
                }));

                return res.status(400).json({
                    success: false,
                    message: 'Invalid route parameters',
                    errors
                });
            }

            // Replace req.params with validated data
            req.params = result.data;
            next();
        } catch (error) {
            console.error('Params validation error:', error);
            return res.status(500).json({
                success: false,
                message: 'Validation error'
            });
        }
    };
};
