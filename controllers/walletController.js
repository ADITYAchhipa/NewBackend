// ============================================================================
// Wallet Controller
// ============================================================================
// Handles all wallet operations including balance, transactions, payment details,
// and withdrawal management

import User from '../models/user.js';

// ============================================================================
// USER ENDPOINTS
// ============================================================================

/**
 * Get Wallet Balance
 * Returns available and pending balance for the authenticated user
 * No KYC required - basic balance information
 */
export const getWalletBalance = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('AvailableBalance PendingBalance TotalEarnings');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                availableBalance: user.AvailableBalance || 0,
                pendingBalance: user.PendingBalance || 0,
                totalEarnings: user.TotalEarnings || 0
            }
        });
    } catch (error) {
        console.error('Get wallet balance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve wallet balance'
        });
    }
};

/**
 * Get Transaction History
 * Returns paginated wallet transaction history
 * Requires KYC completion
 */
export const getTransactionHistory = async (req, res) => {
    try {
        const { page = 1, limit = 20, type } = req.query;
        const skip = (page - 1) * limit;

        const user = await User.findById(req.user._id).select('walletTransactions');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        let transactions = user.walletTransactions || [];

        // Filter by type if specified
        if (type) {
            transactions = transactions.filter(t => t.type === type);
        }

        // Sort by date (newest first)
        transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Paginate
        const total = transactions.length;
        const paginatedTransactions = transactions.slice(skip, skip + parseInt(limit));

        res.status(200).json({
            success: true,
            data: {
                transactions: paginatedTransactions,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get transaction history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve transaction history'
        });
    }
};

/**
 * Add/Update Payment Details
 * Allows users to add or update their bank account or UPI ID
 * Requires KYC completion
 */
export const addPaymentDetails = async (req, res) => {
    try {
        const { type, bankAccount, upiId, preferredMethod } = req.body;

        // Validation
        if (!type || !['bank', 'upi'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment method type. Must be "bank" or "upi"'
            });
        }

        const user = await User.findById(req.user._id).select('+paymentDetails');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Initialize paymentDetails if it doesn't exist
        if (!user.paymentDetails) {
            user.paymentDetails = {};
        }

        // Update based on type
        if (type === 'bank') {
            if (!bankAccount || !bankAccount.accountHolderName || !bankAccount.accountNumber || !bankAccount.ifscCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Bank account details incomplete. Required: accountHolderName, accountNumber, ifscCode'
                });
            }

            user.paymentDetails.bankAccount = {
                accountHolderName: bankAccount.accountHolderName,
                accountNumber: bankAccount.accountNumber,
                ifscCode: bankAccount.ifscCode.toUpperCase(),
                bankName: bankAccount.bankName || '',
                verified: false // Admin will verify manually
            };
        } else if (type === 'upi') {
            if (!upiId || !upiId.includes('@')) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid UPI ID format. Must include @'
                });
            }

            user.paymentDetails.upiId = upiId.toLowerCase();
        }

        // Update preferred method if provided
        if (preferredMethod && ['bank', 'upi'].includes(preferredMethod)) {
            user.paymentDetails.preferredMethod = preferredMethod;
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: `${type === 'bank' ? 'Bank account' : 'UPI ID'} updated successfully`,
            data: {
                paymentDetails: {
                    bankAccount: user.paymentDetails.bankAccount ? {
                        accountHolderName: user.paymentDetails.bankAccount.accountHolderName,
                        accountNumber: '****' + user.paymentDetails.bankAccount.accountNumber.slice(-4),
                        ifscCode: user.paymentDetails.bankAccount.ifscCode,
                        bankName: user.paymentDetails.bankAccount.bankName,
                        verified: user.paymentDetails.bankAccount.verified
                    } : null,
                    upiId: user.paymentDetails.upiId || null,
                    preferredMethod: user.paymentDetails.preferredMethod
                }
            }
        });
    } catch (error) {
        console.error('Add payment details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update payment details'
        });
    }
};

/**
 * Get Payment Details
 * Returns saved payment methods (masked for security)
 * Requires KYC completion
 */
export const getPaymentDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('+paymentDetails');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const paymentDetails = user.paymentDetails || {};

        res.status(200).json({
            success: true,
            data: {
                paymentDetails: {
                    bankAccount: paymentDetails.bankAccount ? {
                        accountHolderName: paymentDetails.bankAccount.accountHolderName,
                        accountNumber: '****' + paymentDetails.bankAccount.accountNumber.slice(-4),
                        ifscCode: paymentDetails.bankAccount.ifscCode,
                        bankName: paymentDetails.bankAccount.bankName,
                        verified: paymentDetails.bankAccount.verified
                    } : null,
                    upiId: paymentDetails.upiId || null,
                    preferredMethod: paymentDetails.preferredMethod || 'upi'
                }
            }
        });
    } catch (error) {
        console.error('Get payment details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve payment details'
        });
    }
};

/**
 * Request Withdrawal
 * Create a new withdrawal request
 * Requires KYC completion and sufficient available balance
 */
export const requestWithdrawal = async (req, res) => {
    try {
        const { amount, method } = req.body;

        // Validation
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid withdrawal amount'
            });
        }

        if (!method || !['bank', 'upi'].includes(method)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment method. Must be "bank" or "upi"'
            });
        }

        const user = await User.findById(req.user._id).select('+paymentDetails AvailableBalance withdrawalRequests');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user has payment details configured
        const paymentDetails = user.paymentDetails || {};
        if (method === 'bank' && !paymentDetails.bankAccount) {
            return res.status(400).json({
                success: false,
                message: 'Please add bank account details before requesting withdrawal via bank transfer'
            });
        }

        if (method === 'upi' && !paymentDetails.upiId) {
            return res.status(400).json({
                success: false,
                message: 'Please add UPI ID before requesting withdrawal via UPI'
            });
        }

        // Check sufficient balance
        if (user.AvailableBalance < amount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient available balance',
                availableBalance: user.AvailableBalance
            });
        }

        // Check for pending withdrawal requests
        const hasPendingWithdrawal = user.withdrawalRequests.some(
            req => req.status === 'pending' || req.status === 'approved'
        );

        if (hasPendingWithdrawal) {
            return res.status(400).json({
                success: false,
                message: 'You already have a pending withdrawal request. Please wait for it to be processed.'
            });
        }

        // Create withdrawal request
        const withdrawalRequest = {
            amount,
            paymentMethod: method,
            status: 'pending',
            requestedAt: new Date()
        };

        user.withdrawalRequests.push(withdrawalRequest);

        // Deduct from available balance (will be refunded if rejected)
        user.AvailableBalance -= amount;

        await user.save();

        res.status(201).json({
            success: true,
            message: 'Withdrawal request submitted successfully',
            data: {
                withdrawalRequest: {
                    amount,
                    paymentMethod: method,
                    status: 'pending',
                    requestedAt: withdrawalRequest.requestedAt
                },
                remainingBalance: user.AvailableBalance
            }
        });
    } catch (error) {
        console.error('Request withdrawal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create withdrawal request'
        });
    }
};

/**
 * Get User's Withdrawal Requests
 * Returns all withdrawal requests for the authenticated user
 * Requires KYC completion
 */
export const getUserWithdrawals = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('withdrawalRequests');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Sort by date (newest first)
        const withdrawals = (user.withdrawalRequests || []).sort(
            (a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)
        );

        res.status(200).json({
            success: true,
            data: { withdrawals }
        });
    } catch (error) {
        console.error('Get user withdrawals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve withdrawal requests'
        });
    }
};

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

/**
 * Get All Withdrawal Requests
 * Admin: View all pending/approved withdrawal requests
 */
export const getAllWithdrawalRequests = async (req, res) => {
    try {
        const { status = 'pending' } = req.query;

        const users = await User.find({
            'withdrawalRequests.status': status
        }).select('name email phone withdrawalRequests');

        // Flatten and filter withdrawal requests
        const withdrawals = [];
        users.forEach(user => {
            user.withdrawalRequests
                .filter(req => req.status === status)
                .forEach(withdrawal => {
                    withdrawals.push({
                        _id: withdrawal._id,
                        userId: user._id,
                        userName: user.name,
                        userEmail: user.email,
                        userPhone: user.phone,
                        amount: withdrawal.amount,
                        paymentMethod: withdrawal.paymentMethod,
                        status: withdrawal.status,
                        requestedAt: withdrawal.requestedAt,
                        processedAt: withdrawal.processedAt,
                        rejectionReason: withdrawal.rejectionReason,
                        transactionId: withdrawal.transactionId
                    });
                });
        });

        // Sort by date (newest first)
        withdrawals.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

        res.status(200).json({
            success: true,
            data: {
                withdrawals,
                count: withdrawals.length
            }
        });
    } catch (error) {
        console.error('Get all withdrawal requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve withdrawal requests'
        });
    }
};

/**
 * Approve Withdrawal Request
 * Admin: Approve a pending withdrawal request
 */
export const approveWithdrawal = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findOne({ 'withdrawalRequests._id': id });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found'
            });
        }

        const withdrawal = user.withdrawalRequests.id(id);

        if (!withdrawal) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found'
            });
        }

        if (withdrawal.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot approve withdrawal with status: ${withdrawal.status}`
            });
        }

        withdrawal.status = 'approved';
        withdrawal.processedBy = req.user._id;

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Withdrawal request approved. Please process the payment externally and mark as processed.',
            data: { withdrawal }
        });
    } catch (error) {
        console.error('Approve withdrawal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve withdrawal request'
        });
    }
};

/**
 * Reject Withdrawal Request
 * Admin: Reject a pending withdrawal request with reason
 */
export const rejectWithdrawal = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required'
            });
        }

        const user = await User.findOne({ 'withdrawalRequests._id': id });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found'
            });
        }

        const withdrawal = user.withdrawalRequests.id(id);

        if (!withdrawal) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found'
            });
        }

        if (withdrawal.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot reject withdrawal with status: ${withdrawal.status}`
            });
        }

        withdrawal.status = 'rejected';
        withdrawal.rejectionReason = reason;
        withdrawal.processedAt = new Date();
        withdrawal.processedBy = req.user._id;

        // Refund the amount back to available balance
        user.AvailableBalance += withdrawal.amount;

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Withdrawal request rejected and amount refunded',
            data: { withdrawal }
        });
    } catch (error) {
        console.error('Reject withdrawal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reject withdrawal request'
        });
    }
};

/**
 * Mark Withdrawal as Processed
 * Admin: Mark an approved withdrawal as processed after external payment
 */
export const markWithdrawalProcessed = async (req, res) => {
    try {
        const { id } = req.params;
        const { transactionId } = req.body;

        const user = await User.findOne({ 'withdrawalRequests._id': id });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found'
            });
        }

        const withdrawal = user.withdrawalRequests.id(id);

        if (!withdrawal) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found'
            });
        }

        if (withdrawal.status !== 'approved') {
            return res.status(400).json({
                success: false,
                message: `Cannot mark as processed. Current status: ${withdrawal.status}. Must be "approved" first.`
            });
        }

        withdrawal.status = 'processed';
        withdrawal.processedAt = new Date();
        withdrawal.transactionId = transactionId || '';
        withdrawal.processedBy = req.user._id;

        // Add transaction record
        user.walletTransactions.push({
            type: 'withdrawal',
            amount: -withdrawal.amount,
            status: 'completed',
            description: `Withdrawal processed via ${withdrawal.paymentMethod}`,
            createdAt: new Date()
        });

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Withdrawal marked as processed',
            data: { withdrawal }
        });
    } catch (error) {
        console.error('Mark withdrawal processed error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark withdrawal as processed'
        });
    }
};

// ============================================================================
// HELPER FUNCTIONS (for internal use by other controllers)
// ============================================================================

/**
 * Add Wallet Transaction
 * Internal helper function to record wallet transactions
 */
export const addWalletTransaction = async (userId, transactionData) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        user.walletTransactions.push({
            type: transactionData.type,
            amount: transactionData.amount,
            status: transactionData.status || 'completed',
            description: transactionData.description,
            bookingId: transactionData.bookingId,
            createdAt: new Date()
        });

        await user.save();
        return true;
    } catch (error) {
        console.error('Add wallet transaction error:', error);
        throw error;
    }
};

/**
 * Update User Balance
 * Internal helper function to update available/pending balance
 */
export const updateUserBalance = async (userId, balanceUpdates) => {
    try {
        const updateFields = {};

        if (balanceUpdates.availableBalance !== undefined) {
            updateFields.AvailableBalance = balanceUpdates.availableBalance;
        }

        if (balanceUpdates.pendingBalance !== undefined) {
            updateFields.PendingBalance = balanceUpdates.pendingBalance;
        }

        if (balanceUpdates.totalEarnings !== undefined) {
            updateFields.TotalEarnings = balanceUpdates.totalEarnings;
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $inc: updateFields },
            { new: true }
        ).select('AvailableBalance PendingBalance TotalEarnings');

        return user;
    } catch (error) {
        console.error('Update user balance error:', error);
        throw error;
    }
};
