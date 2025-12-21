import sgMail from '@sendgrid/mail';

// Initialize SendGrid (API key from environment)
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Send email alert when owner's pending balance goes negative
 * @param {String} ownerId - Owner user ID
 * @param {Number} newBalance - New pending balance (negative)
 */
export const sendNegativeBalanceAlert = async (ownerId, newBalance) => {
    try {
        if (!process.env.SENDGRID_API_KEY) {
            console.warn('SendGrid API key not configured. Skipping email alert.');
            return;
        }

        const msg = {
            to: 'adichhipa2@gmail.com',
            from: process.env.SENDGRID_FROM_EMAIL || 'noreply@rentaly.com',
            subject: '⚠️ ALERT: Owner Pending Balance Negative',
            text: `
ALERT: Owner Pending Balance Negative

Owner ID: ${ownerId}
New Pending Balance: ₹${newBalance.toFixed(2)}

Action Required: Review owner transactions and pending balance.

Timestamp: ${new Date().toISOString()}
            `,
            html: `
                <h2 style="color: #ff6b6b;">⚠️ ALERT: Owner Pending Balance Negative</h2>
                <p><strong>Owner ID:</strong> ${ownerId}</p>
                <p><strong>New Pending Balance:</strong> <span style="color: #ff6b6b; font-size: 18px; font-weight: bold;">₹${newBalance.toFixed(2)}</span></p>
                <p><strong>Action Required:</strong> Review owner transactions and pending balance.</p>
                <hr>
                <p style="color: #666; font-size: 12px;">Timestamp: ${new Date().toISOString()}</p>
            `
        };

        await sgMail.send(msg);
        console.log(`[EMAIL ALERT] Negative balance alert sent for owner ${ownerId}`);
    } catch (error) {
        console.error('[EMAIL ALERT] Failed to send negative balance alert:', error);
        // Don't throw - email failure shouldn't block the cancellation
    }
};
