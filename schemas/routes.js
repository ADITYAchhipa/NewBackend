/**
 * Route-Specific Validation Schemas
 * Schemas for specific endpoints (reviews, disputes, etc.)
 */

import { z } from 'zod';
import { objectIdSchema } from './common.js';

// ============================================================================
// REVIEW SCHEMAS
// ============================================================================

export const createReviewSchema = z.object({
    type: z.enum(['property', 'vehicle']),
    itemId: objectIdSchema,
    rating: z.number().int().min(1).max(5),
    comment: z.string().min(10).max(1000).trim(),
    detailedRatings: z.record(z.string(), z.number().min(1).max(5)).optional(),
    images: z.array(z.string().url()).max(5).optional()
}).strict();

export const updateReviewSchema = z.object({
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().min(10).max(1000).trim().optional(),
    detailedRatings: z.record(z.string(), z.number().min(1).max(5)).optional(),
    images: z.array(z.string().url()).max(5).optional()
}).strict().refine(
    data => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
);

// ============================================================================
// DISPUTE SCHEMAS
// ============================================================================

export const createDisputeSchema = z.object({
    title: z.string().min(5).max(200).trim(),
    description: z.string().min(20).max(2000).trim(),
    category: z.enum(['payment', 'property', 'vehicle', 'booking', 'service', 'other']),
    priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
    itemType: z.enum(['property', 'vehicle', 'booking']).optional(),
    itemId: objectIdSchema.optional(),
    evidence: z.array(z.string().url()).max(10).optional()
}).strict();

export const updateDisputeSchema = z.object({
    title: z.string().min(5).max(200).trim().optional(),
    description: z.string().min(20).max(2000).trim().optional(),
    category: z.enum(['payment', 'property', 'vehicle', 'booking', 'service', 'other']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    evidence: z.array(z.string().url()).max(10).optional()
}).strict().refine(
    data => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
);

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

export const propertySearchSchema = z.object({
    query: z.string().min(1).max(200).trim().optional(),
    location: z.string().max(100).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    bedrooms: z.coerce.number().int().min(0).max(20).optional(),
    propertyType: z.string().max(50).optional(),
    amenities: z.array(z.string().max(50)).max(20).optional()
}).strict();

export const vehicleSearchSchema = z.object({
    query: z.string().min(1).max(200).trim().optional(),
    location: z.string().max(100).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    category: z.string().max(50).optional(),
    make: z.string().max(50).optional(),
    model: z.string().max(50).optional(),
    year: z.coerce.number().int().min(1900).max(2100).optional()
}).strict();
