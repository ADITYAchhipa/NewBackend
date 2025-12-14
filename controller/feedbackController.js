import { sendFeedback } from '../services/resendService.js';

/**
 * Submit user feedback via email
 * POST /api/feedback
 */
export const submitFeedback = async (req, res) => {
    try {
        const { category, rating, message } = req.body;
        const user = req.user;

        // Validate required fields
        if (!message || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Feedback message is required'
            });
        }

        if (!category) {
            return res.status(400).json({
                success: false,
                message: 'Category is required'
            });
        }

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Send feedback email via Resend
        const emailSent = await sendFeedback({
            category,
            rating: parseInt(rating),
            message: message.trim(),
            userEmail: user.email,
            userName: user.name || 'Anonymous User'
        });

        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send feedback. Please try again later.'
            });
        }

        console.log(`✅ Feedback submitted by ${user.email}: [${category}] ${rating}/5`);

        return res.status(200).json({
            success: true,
            message: 'Thank you for your feedback!'
        });

    } catch (error) {
        console.error('❌ Error submitting feedback:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while submitting feedback'
        });
    }
};
