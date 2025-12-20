/**
 * Common Validation Schemas
 * Shared schemas for pagination, search, dates, etc.
 */

import { z } from 'zod';

// ============================================================================
// PAGINATION
// ============================================================================

export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
}).strict();

// ============================================================================
// SEARCH
// ============================================================================

export const searchSchema = z.object({
    query: z.string().min(1).max(200).trim().optional(),
    q: z.string().min(1).max(200).trim().optional(), // Alternative
    type: z.enum(['property', 'vehicle']).optional(),
    category: z.string().max(50).optional()
}).strict();

// ============================================================================
// SORT
// ============================================================================

export const sortSchema = z.object({
    sort: z.enum(['asc', 'desc', 'newest', 'oldest', 'price-low', 'price-high', 'rating']).optional(),
    sortBy: z.enum(['createdAt', 'price', 'rating', 'name']).optional()
}).strict();

// ============================================================================
// DATE RANGE
// ============================================================================

export const dateRangeSchema = z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional()
}).strict().refine(
    data => !data.startDate || !data.endDate || data.startDate <= data.endDate,
    { message: 'startDate must be before or equal to endDate' }
);

// ============================================================================
// OBJECTID
// ============================================================================

export const objectIdSchema = z.string().regex(
    /^[0-9a-fA-F]{24}$/,
    'Invalid ID format'
);

export const objectIdParamSchema = z.object({
    id: objectIdSchema
}).strict();

// ============================================================================
// COMBINED SCHEMAS
// ============================================================================

// Search with pagination
export const searchWithPaginationSchema = searchSchema.merge(paginationSchema);

// Search with pagination and sort
export const fullSearchSchema = searchSchema
    .merge(paginationSchema)
    .merge(sortSchema);
