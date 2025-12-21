// ============================================================================
// Wallet Routes
// ============================================================================
// API routes for wallet operations with KYC and authentication middleware

import express from 'express';
import authenticateToken from '../middleware/authUser.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';
import { requireKYC } from '../middleware/kycMiddleware.js';
import {
    getWalletBalance,
    getTransactionHistory,
    addPaymentDetails,
    getPaymentDetails,
    requestWithdrawal,
    getUserWithdrawals,
    getAllWithdrawalRequests,
    approveWithdrawal,
    rejectWithdrawal,
    markWithdrawalProcessed
} from '../controllers/walletController.js';

const router = express.Router();

// ============================================================================
// USER ROUTES (Require Authentication)
// ============================================================================

/**
 * @route   GET /api/wallet/balance
 * @desc    Get current wallet balance
 * @access  Private (authenticated users only, no KYC required)
 */
router.get('/balance', authenticateToken, getWalletBalance);

/**
 * @route   GET /api/wallet/transactions
 * @desc    Get transaction history (paginated)
 * @access  Private (requires KYC)
 * @query   page, limit, type
 */
router.get('/transactions', authenticateToken, requireKYC, getTransactionHistory);

/**
 * @route   POST /api/wallet/payment-details
 * @desc    Add or update payment details (bank or UPI)
 * @access  Private (requires KYC)
 * @body    { type: 'bank'|'upi', bankAccount: {...}, upiId: '...', preferredMethod: '...' }
 */
router.post('/payment-details', authenticateToken, requireKYC, addPaymentDetails);

/**
 * @route   GET /api/wallet/payment-details
 * @desc    Get saved payment details (masked)
 * @access  Private (requires KYC)
 */
router.get('/payment-details', authenticateToken, requireKYC, getPaymentDetails);

/**
 * @route   POST /api/wallet/withdraw
 * @desc    Request withdrawal
 * @access  Private (requires KYC)
 * @body    { amount: number, method: 'bank'|'upi' }
 */
router.post('/withdraw', authenticateToken, requireKYC, requestWithdrawal);

/**
 * @route   GET /api/wallet/withdrawals
 * @desc    Get user's withdrawal requests
 * @access  Private (requires KYC)
 */
router.get('/withdrawals', authenticateToken, requireKYC, getUserWithdrawals);

// ============================================================================
// ADMIN ROUTES (Require Admin Authentication)
// ============================================================================

/**
 * @route   GET /api/wallet/admin/withdrawals
 * @desc    Get all withdrawal requests by status
 * @access  Admin only
 * @query   status (default: 'pending')
 */
router.get('/admin/withdrawals', authenticateToken, requireAdmin, getAllWithdrawalRequests);

/**
 * @route   PATCH /api/wallet/admin/withdrawals/:id/approve
 * @desc    Approve a withdrawal request
 * @access  Admin only
 */
router.patch('/admin/withdrawals/:id/approve', authenticateToken, requireAdmin, approveWithdrawal);

/**
 * @route   PATCH /api/wallet/admin/withdrawals/:id/reject
 * @desc    Reject a withdrawal request
 * @access  Admin only
 * @body    { reason: string }
 */
router.patch('/admin/withdrawals/:id/reject', authenticateToken, requireAdmin, rejectWithdrawal);

/**
 * @route   PATCH /api/wallet/admin/withdrawals/:id/process
 * @desc    Mark approved withdrawal as processed
 * @access  Admin only
 * @body    { transactionId?: string }
 */
router.patch('/admin/withdrawals/:id/process', authenticateToken, requireAdmin, markWithdrawalProcessed);

export default router;
