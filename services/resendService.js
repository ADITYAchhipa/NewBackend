import { Resend } from 'resend';
import 'dotenv/config';

// Initialize Resend with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

// Email sender address - use Resend's default for development
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

/**
 * Send OTP email to user
 * @param {string} otp - The OTP code
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name (optional)
 * @returns {Promise<boolean>} - Whether email was sent successfully
 */
export async function sendOtp(otp, email, name = 'User') {
    try {
        console.log(`📧 Sending OTP to: ${email}`);

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Your Verification Code - Rentaly',
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { padding: 40px 30px; text-align: center; }
            .otp-box { background: linear-gradient(135deg, #f3f4f6, #e5e7eb); border-radius: 12px; padding: 25px; margin: 25px 0; }
            .otp-code { font-size: 36px; font-weight: bold; color: #4f46e5; letter-spacing: 8px; font-family: monospace; }
            .warning { color: #6b7280; font-size: 14px; margin-top: 20px; }
            .footer { background: #f9fafb; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏠 Rentaly</h1>
            </div>
            <div class="content">
              <h2>Hello ${name}! 👋</h2>
              <p>Your verification code is:</p>
              <div class="otp-box">
                <span class="otp-code">${otp}</span>
              </div>
              <p class="warning">
                ⏰ This code expires in <strong>5 minutes</strong>.<br>
                🔒 Never share this code with anyone.
              </p>
            </div>
            <div class="footer">
              <p>If you didn't request this code, please ignore this email.</p>
              <p>© ${new Date().getFullYear()} Rentaly. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
            text: `Hello ${name}! Your Rentaly verification code is: ${otp}. This code expires in 5 minutes. Never share this code with anyone.`
        });

        if (error) {
            console.error('❌ Resend Error:', error);
            return false;
        }

        console.log('✅ OTP email sent successfully. ID:', data?.id);
        return true;
    } catch (error) {
        console.error('❌ Failed to send OTP email:', error.message || error);
        return false;
    }
}

/**
 * Send welcome email after successful registration
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @returns {Promise<boolean>}
 */
export async function sendWelcome(email, name) {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Welcome to Rentaly! 🎉',
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #10b981, #059669); padding: 40px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 28px; }
            .content { padding: 40px 30px; text-align: center; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 15px 35px; border-radius: 30px; text-decoration: none; font-weight: bold; margin-top: 20px; }
            .footer { background: #f9fafb; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Rentaly! 🎉</h1>
            </div>
            <div class="content">
              <h2>Hey ${name}! 👋</h2>
              <p>Your account has been successfully created.</p>
              <p>Start exploring amazing properties and vehicles available for rent!</p>
              <a href="#" class="cta-button">Start Exploring</a>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Rentaly. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
            text: `Welcome to Rentaly, ${name}! Your account has been successfully created. Start exploring amazing properties and vehicles available for rent!`
        });

        if (error) {
            console.error('❌ Resend Error (Welcome):', error);
            return false;
        }

        console.log('✅ Welcome email sent. ID:', data?.id);
        return true;
    } catch (error) {
        console.error('❌ Failed to send welcome email:', error.message || error);
        return false;
    }
}

/**
 * Send password reset OTP email
 * @param {string} otp - The OTP code
 * @param {string} email - Recipient email
 * @returns {Promise<boolean>}
 */
export async function sendPasswordResetOtp(otp, email) {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Password Reset Code - Rentaly',
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { padding: 40px 30px; text-align: center; }
            .otp-box { background: linear-gradient(135deg, #fef3c7, #fde68a); border-radius: 12px; padding: 25px; margin: 25px 0; }
            .otp-code { font-size: 36px; font-weight: bold; color: #92400e; letter-spacing: 8px; font-family: monospace; }
            .warning { color: #6b7280; font-size: 14px; margin-top: 20px; }
            .footer { background: #f9fafb; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset</h1>
            </div>
            <div class="content">
              <h2>Reset Your Password</h2>
              <p>Use this code to reset your password:</p>
              <div class="otp-box">
                <span class="otp-code">${otp}</span>
              </div>
              <p class="warning">
                ⏰ This code expires in <strong>10 minutes</strong>.<br>
                🔒 If you didn't request this, please ignore this email.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Rentaly. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
            text: `Your Rentaly password reset code is: ${otp}. This code expires in 10 minutes. If you didn't request this, please ignore this email.`
        });

        if (error) {
            console.error('❌ Resend Error (Password Reset):', error);
            return false;
        }

        console.log('✅ Password reset email sent. ID:', data?.id);
        return true;
    } catch (error) {
        console.error('❌ Failed to send password reset email:', error.message || error);
        return false;
    }
}

// Default export for backward compatibility
export default sendOtp;
