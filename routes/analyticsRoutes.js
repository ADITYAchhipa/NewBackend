// routes/analyticsRoutes.js
// Analytics API routes for owner dashboard
import express from 'express';
import {
    getOwnerAnalytics,
    getRevenueBreakdown,
    getInsights
} from '../controller/analyticsController.js';
import { getEarningsHistory } from '../controller/earningsController.js';
import authUser from '../middleware/authUser.js';

const router = express.Router();

/**
 * @route   GET /api/analytics/owner
 * @desc    Get comprehensive analytics for the logged-in owner
 * @access  Private (requires authentication)
 * @query   assetType - 'property' | 'vehicle' | 'all' (default: 'all')
 * @query   dateFrom - Start date (ISO string, default: 30 days ago)
 * @query   dateTo - End date (ISO string, default: today)
 * @query   location - City name filter
 * @query   category - Asset category filter
 */
router.get('/owner', authUser, getOwnerAnalytics);

/**
 * @route   GET /api/analytics/owner/revenue
 * @desc    Get revenue breakdown (monthly, daily, by category)
 * @access  Private
 */
router.get('/owner/revenue', authUser, getRevenueBreakdown);

/**
 * @route   GET /api/analytics/owner/insights
 * @desc    Get AI-powered insights and recommendations
 * @access  Private
 */
router.get('/owner/insights', authUser, getInsights);

/**
 * @route   GET /api/analytics/earnings-history
 * @desc    Get earnings history for charts (30D daily, Monthly, Yearly)
 * @access  Private
 * @query   period - '30D' | 'Monthly' | 'Yearly'
 * @query   type - 'properties' | 'vehicles'
 */
router.get('/earnings-history', authUser, getEarningsHistory);

export default router;

