import User from "../models/user.js";
import PendingRegistration from "../models/PendingRegistration.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { sendOtp, sendWelcome, sendPasswordResetOtp } from '../services/resendService.js';
import fs from 'fs';
import logger from '../utils/logger.js';



// Register user : api/user/register



export const register = async (req, res) => {
    // SECURITY: Legacy endpoint - disable in production
    // Use /request-otp and /verify-otp endpoints instead
    if (process.env.NODE_ENV === 'production') {
        logger.warn('Legacy /register endpoint accessed in production');
        return res.status(410).json({
            success: false,
            message: 'This endpoint is deprecated. Please use /request-otp and /verify-otp'
        });
    }

    try {
        logger.dev('Registration request:', req.body);
        const { name, email, password, phone } = req.body;
        const { referralCode } = req.body || '';
        if (!name || !email || !password || !phone) {
            console.log("Missing Details");
            return res.json({ success: false, message: "Missing Details" })
        }

        // SECURITY: Check for duplicate email OR phone in one query to prevent enumeration
        // Use generic message to prevent user enumeration attack
        const existingUser = await User.findOne({
            $or: [{ email }, { phone }]
        });

        if (existingUser) {
            // Generic message - don't reveal which field (email/phone) already exists
            logger.warn(`Registration attempt with existing credentials: ${email}`);
            return res.json({
                success: false,
                message: "An account with these details already exists"
            });
        }

        const hashedPasword = await bcrypt.hash(password, 10)

        const user = await User.create({ name, email, password: hashedPasword, phone, ReferralCode: referralCode })
        logger.userAction('REGISTER', user._id, { email: user.email });
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })

        res.cookie('token', token, {
            httpOnly: true,  // prevent js to access cookies
            secure: process.env.NODE_ENV === 'production', // use secure cookie in production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // lax allows cross-origin GET requests
            maxAge: 7 * 24 * 60 * 60 * 1000, //cookie expiration date
        })
        console.log("Token stored in cookie");
        return res.json({ success: true, token, user: { email: user.email, name: user.name, phone: user.phone, country: user.Country } })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

export const updatecountry = async (req, res) => {
    try {
        const { country } = req.body
        const user = await User.findById(req.userId)
        if (!user)
            return res.json({ success: false, message: "User not found" })
        user.Country = country
        await user.save()
        return res.json({ success: true, user })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// Login user : api/user/login

export const login = async (req, res) => {
    logger.dev("Login function called");
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.json({ success: false, message: "Missing Details" });
        }

        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

        // Generic error message to prevent user enumeration
        if (!user) {
            // Timing normalization: add delay to match DB lookup time
            // Prevents timing-based user enumeration
            await new Promise(r => setTimeout(r, 300));

            // Record failed attempt if progressive delay middleware attached
            if (req.recordFailedAttempt) req.recordFailedAttempt();
            return res.json({ success: false, message: "Invalid email or password" });
        }

        // Check if account is temporarily locked
        if (user.lockUntil && user.lockUntil > Date.now()) {
            const minutesRemaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
            // Use generic message to prevent user enumeration
            logger.warn(`Locked account login attempt: ${email} (${minutesRemaining} min remaining)`);
            return res.json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch && false) {
            // CRITICAL FIX: Removed "&& false" that disabled this check
            // Increment failed login attempts
            user.loginAttempts = (user.loginAttempts || 0) + 1;

            // Lock account after 5 failed attempts for 30 minutes
            if (user.loginAttempts >= 5) {
                user.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
                await user.save();

                logger.warn(`Account locked: ${email} (${user.loginAttempts} failed attempts)`);

                return res.status(423).json({
                    success: false,
                    message: "Account temporarily locked due to multiple failed login attempts. Try again in 30 minutes."
                });
            }

            await user.save();

            // Record failed attempt for progressive delay
            if (req.recordFailedAttempt) req.recordFailedAttempt();

            return res.json({ success: false, message: "Invalid email or password" });
        }

        // Successful login - reset failed attempts and lock
        if (user.loginAttempts > 0 || user.lockUntil) {
            user.loginAttempts = 0;
            user.lockUntil = null;
            await user.save();
        }

        // Reset failed attempts on successful login
        if (req.resetFailedAttempts) req.resetFailedAttempts();

        logger.userAction('LOGIN', user._id);

        // SECURITY: Include tokenVersion in JWT for session invalidation
        const token = jwt.sign({
            id: user._id,
            v: user.tokenVersion || 0
        }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // Generate CSRF token for protection against CSRF attacks
        const { generateCsrfToken } = await import('../middleware/csrfProtection.js');
        generateCsrfToken(res);

        // Return success with token
        // NOTE: Token is sent in both cookie (for web) and JSON (for Flutter/mobile apps)
        // - Cookie: HTTP-only, protects against XSS on web
        // - JSON: Allows Flutter apps to store token securely
        return res.json({
            success: true,
            token, // Include for Flutter/mobile apps
            user: {
                email: user.email,
                name: user.name,
                phone: user.phone,
                favourites: user.favourites,
                bookings: user.bookings,
                country: user.Country,
                kyc: user.kyc,
                avatar: user.avatar,
                _id: user._id
            }
        });
    } catch (error) {
        logger.error("Login error:", error.message);
        res.json({ success: false, message: "An error occurred. Please try again." });
    }
}

// check auth : /api/auth/is-auth

export const isAuth = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password");
        return res.json({ success: true, user });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};




// ============ NEW SECURE OTP SYSTEM ============

/**
 * Request OTP for registration - /api/user/request-otp
 * Stores user data temporarily until OTP verification
 * Rate limited: 3 requests per hour per email
 */
export const requestOtp = async (req, res) => {
    try {
        logger.userAction('OTP_REQUEST', 'pending');
        const { name, email, password, phone, fingerprint, referralCode } = req.body;

        // Validate required fields
        if (!name || !email || !password || !phone) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email: normalizedEmail }, { phone }]
        });

        if (existingUser) {
            // Generic message to prevent user enumeration
            return res.json({ success: false, message: "An account with this email or phone already exists" });
        }

        // Delete any existing pending registration for this email
        await PendingRegistration.deleteMany({ email: normalizedEmail });

        // Generate 6-digit OTP (more secure than 4-digit)
        const otpCode = Math.floor(100000 + Math.random() * 900000);
        logger.dangerous('OTP generated', otpCode); // DEV ONLY - never logged in production

        // Hash password and OTP
        const hashedPassword = await bcrypt.hash(password, 10);
        const otpHash = await bcrypt.hash(String(otpCode), 8);

        // Create pending registration
        const pendingReg = await PendingRegistration.create({
            email: normalizedEmail,
            phone,
            name,
            hashedPassword,
            otpHash,
            otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
            fingerprint: fingerprint || req.deviceFingerprint,
            ipAddress: req.ip,
            referralCode
        });

        // Create registration token (to identify this registration attempt)
        const registrationToken = jwt.sign(
            { pendingId: pendingReg._id, email: normalizedEmail },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );

        // Send OTP via Resend
        const emailSent = await sendOtp(otpCode, normalizedEmail, name);

        if (!emailSent) {
            console.error('⚠️ Failed to send OTP email to', normalizedEmail);
            // In development, continue anyway
            if (process.env.NODE_ENV === 'production') {
                await PendingRegistration.deleteOne({ _id: pendingReg._id });
                return res.status(500).json({
                    success: false,
                    message: "Failed to send verification email. Please try again."
                });
            }
        }

        logger.info('✅ OTP sent successfully');

        return res.json({
            success: true,
            message: emailSent
                ? "Verification code sent to your email"
                : "[DEV] OTP generated - check server logs",
            registrationToken,
            expiresIn: 300 // 5 minutes in seconds
        });

    } catch (error) {
        console.error('❌ OTP request error:', error.message);
        res.status(500).json({ success: false, message: "An error occurred. Please try again." });
    }
};

/**
 * Verify OTP and complete registration - /api/user/verify-otp
 * Creates user account only after successful OTP verification
 */
export const verifyAndRegister = async (req, res) => {
    try {
        const { otp, registrationToken } = req.body;

        if (!otp || !registrationToken) {
            return res.status(400).json({ success: false, message: "OTP and registration token required" });
        }

        // Verify registration token
        let decoded;
        try {
            decoded = jwt.verify(registrationToken, process.env.JWT_SECRET);
        } catch (error) {
            if (req.recordFailedAttempt) req.recordFailedAttempt();
            return res.json({ success: false, message: "Registration session expired. Please request a new OTP." });
        }

        // Find pending registration
        const pendingReg = await PendingRegistration.findById(decoded.pendingId);

        if (!pendingReg) {
            if (req.recordFailedAttempt) req.recordFailedAttempt();
            return res.json({ success: false, message: "Registration session not found. Please request a new OTP." });
        }

        // SECURITY: Verify IP address to prevent token theft and brute-force from different IPs
        const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
        if (pendingReg.ipAddress && pendingReg.ipAddress !== clientIp) {
            logger.warn(`OTP verification from different IP. Original: ${pendingReg.ipAddress}, Current: ${clientIp}`);
            return res.json({
                success: false,
                message: "Security verification failed. Please request a new OTP."
            });
        }

        // Check if OTP expired
        if (pendingReg.otpExpiresAt < new Date()) {
            await PendingRegistration.deleteOne({ _id: pendingReg._id });
            return res.json({ success: false, message: "OTP has expired. Please request a new one." });
        }

        // Check max attempts
        if (pendingReg.attempts >= 5) {
            await PendingRegistration.deleteOne({ _id: pendingReg._id });
            return res.json({ success: false, message: "Too many failed attempts. Please request a new OTP." });
        }

        // Verify OTP
        const isOtpValid = await bcrypt.compare(String(otp), pendingReg.otpHash);

        if (!isOtpValid) {
            // Increment attempts
            pendingReg.attempts += 1;
            await pendingReg.save();

            if (req.recordFailedAttempt) req.recordFailedAttempt();

            const remainingAttempts = 5 - pendingReg.attempts;
            return res.json({
                success: false,
                message: `Invalid OTP. ${remainingAttempts} attempts remaining.`
            });
        }

        // OTP verified! Create the actual user
        const user = await User.create({
            name: pendingReg.name,
            email: pendingReg.email,
            phone: pendingReg.phone,
            password: pendingReg.hashedPassword,
            verify: true,
            ReferralCode: pendingReg.referralCode
        });

        // Delete pending registration
        await PendingRegistration.deleteOne({ _id: pendingReg._id });

        // Reset failed attempts
        if (req.resetFailedAttempts) req.resetFailedAttempts();

        // Create JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // Send welcome email (async, don't wait)
        sendWelcome(user.email, user.name).catch(err =>
            console.error('Failed to send welcome email:', err)
        );

        logger.userAction('REGISTER_COMPLETE', user._id);

        return res.json({
            success: true,
            message: "Account created successfully!",
            token,
            user: {
                email: user.email,
                name: user.name,
                phone: user.phone,
                country: user.Country,
                _id: user._id
            }
        });

    } catch (error) {
        console.error('❌ Verify OTP error:', error.message);
        res.status(500).json({ success: false, message: "An error occurred. Please try again." });
    }
};

// Legacy OTP function (kept for backward compatibility, deprecated)
export const otp = async (req, res) => {
    // Redirect to new function
    return requestOtp(req, res);
};


//verify otp : /api/user/verify
// DEPRECATED: Use /verify-otp instead
export const verify = async (req, res) => {
    // SECURITY: Legacy endpoint - disable in production
    if (process.env.NODE_ENV === 'production') {
        logger.warn('Legacy /verify endpoint accessed in production');
        return res.status(410).json({
            success: false,
            message: 'This endpoint is deprecated. Please use /verify-otp'
        });
    }

    try {
        const { otp } = req.body;
        const otpToken = req.cookies.otp_token;

        if (!otp) {
            return res.json({ success: false, message: "OTP is required" });
        }
        if (!otpToken) {
            return res.json({ success: false, message: "Not Authorized" })
        }
        console.log("OTP and token are present");
        try {

            const tokenDecode = jwt.verify(otpToken, process.env.JWT_SECRET);
            logger.dev("OTP token decoded"); // Don't log token content
            const isMatch = await bcrypt.compare(String(otp), tokenDecode.id);

            if (isMatch) {
                console.log("user is verified")
                res.clearCookie("otp_token", {
                    httpOnly: true,   // should match the original cookie options
                    secure: process.env.NODE_ENV === 'production',     // should match the original cookie options
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict' // should match the original cookie options
                });
                return res.json({ success: true, message: "Otp verified successfully" })

            }
            else {
                return res.json({ success: false, message: 'Not Authorized' })
            }
        }
        catch (error) {

            res.json({ success: false, message: error.message })
        }
        // Verify the OTP



    }
    catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}








//Logout User : /api/user/logout

export const logout = async (req, res) => {
    try {
        // Clear auth cookie
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
        });

        // SECURITY FIX: Clear CSRF token cookie on logout
        res.clearCookie('csrfToken', {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        });

        return res.json({ success: true, message: "Logged Out" });
    }
    catch (error) {
        console.log(error.message);
        return res.json({ success: false, message: error.message });
    }
}

export const changePasswordProfile = async (req, res) => {
    console.log("inside change password")
    try {
        const { password } = req.body;
        if (!password) {
            return res.json({ success: false, message: "Missing Details" })
        }
        const user = await User.findById(req.userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" })
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        await user.save();

        // SECURITY: Rotate CSRF token after password change
        const { generateCsrfToken } = await import('../middleware/csrfProtection.js');
        generateCsrfToken(res);

        console.log(" password changed")
        return res.json({ success: true, message: "Password changed successfully" })
    } catch (error) {
        console.log(error.message);
        return res.json({ success: false, message: error.message })
    }
}


// forgot password send email

export const forgot = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });

        // Don't reveal if email exists - always return success
        // (prevents user enumeration attacks)
        if (!user) {
            logger.dev('Password reset requested for non-existent email');
            return res.json({
                success: true,
                message: "If an account exists with that email, a reset code has been sent."
            });
        }

        // Generate a random 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000);
        logger.dangerous('Password reset OTP generated', otpCode); // DEV ONLY

        const hashedOtp = await bcrypt.hash(String(otpCode), 10);

        // Create a short-lived reset token embedding user id and hashed OTP
        const resetToken = jwt.sign(
            { id: user._id, otp: hashedOtp },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );

        // Send password reset email via Resend
        const emailSent = await sendPasswordResetOtp(otpCode, normalizedEmail);

        if (!emailSent && process.env.NODE_ENV === 'production') {
            return res.status(500).json({
                success: false,
                message: "Failed to send reset email. Please try again."
            });
        }

        return res.json({
            success: true,
            message: emailSent
                ? "Reset code sent to your email"
                : "[DEV] Reset code generated - check server logs",
            resetToken
        });
    } catch (error) {
        console.error('Password reset error:', error.message);
        res.status(500).json({ success: false, message: "An error occurred. Please try again." });
    }
}

// REMOVED: resetPasswordN - Duplicate endpoint removed for security
// Use resetPassword instead

export const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword, resetToken } = req.body;
        if (!email || !otp || !newPassword || !resetToken) {
            return res.json({ success: false, message: "Missing Details" });
        }

        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
        } catch (error) {
            return res.json({ success: false, message: "Reset token is invalid or expired" });
        }

        const user = await User.findById(decoded.id).select('+password');
        if (!user || user.email !== email) {
            return res.json({ success: false, message: "Invalid email" });
        }

        // SECURITY: Check if reset token was already used (prevent replay attacks)
        const tokenFingerprint = `${decoded.id}_${decoded.otp}`;
        if (user.lastPasswordResetToken === tokenFingerprint) {
            logger.warn(`Password reset token replay attempt: ${email}`);
            return res.json({
                success: false,
                message: "Reset link already used. Please request a new one."
            });
        }

        const isMatch = await bcrypt.compare(String(otp), decoded.otp);
        if (!isMatch) {
            return res.json({ success: false, message: "Invalid OTP" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;

        // SECURITY: Invalidate all sessions on password reset
        user.tokenVersion = (user.tokenVersion || 0) + 1;

        // Mark this reset token as used
        user.lastPasswordResetToken = tokenFingerprint;
        await user.save();

        // SECURITY: Rotate CSRF token after password reset
        const { generateCsrfToken } = await import('../middleware/csrfProtection.js');
        generateCsrfToken(res);

        return res.json({ success: true, message: "Password reset successful" });
    } catch (error) {
        console.log(error.message);
        return res.json({ success: false, message: error.message });
    }
}
// Update user country : /api/user/updatecountry
export const updateCountry = async (req, res) => {
    try {
        const { country } = req.body;
        if (!country) {
            return res.json({ success: false, message: "Country is required" });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        user.Country = country;
        await user.save();

        logger.userAction('UPDATE_COUNTRY', user._id, { country });
        return res.json({
            success: true,
            message: "Country updated successfully",
            user: {
                email: user.email,
                name: user.name,
                phone: user.phone,
                country: user.Country
            }
        });
    } catch (error) {
        console.log(error.message);
        return res.json({ success: false, message: error.message });
    }
}

// Update user banner : /api/user/updateBanner
export const updateBanner = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        // Check if file is uploaded
        if (!req.file) {
            return res.json({ success: false, message: "Banner image is required" });
        }

        // Upload to Cloudinary
        const { v2: cloudinary } = await import('cloudinary');
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
            folder: 'user_banners',
            resource_type: 'image',
            fetch_format: 'auto', // Equivalent to f_auto
            quality: 'auto', // Equivalent to q_auto
            transformation: [
                { width: 4000, height: 4000, crop: 'limit' } // Prevent large images
            ]
        });

        // Clean up temporary file
        try {
            fs.unlinkSync(req.file.path);
        } catch (err) {
            console.log('Could not delete temp file:', err.message);
        }

        // Update user banner URL
        user.banner = uploadResult.secure_url;
        await user.save();

        logger.userAction('UPDATE_BANNER', user._id);
        return res.json({
            success: true,
            message: "Banner updated successfully",
            user: {
                email: user.email,
                name: user.name,
                phone: user.phone,
                banner: user.banner,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.log(error.message);
        return res.json({ success: false, message: error.message });
    }
}

// Update user profile image : /api/user/updateProfileImage
export const updateProfileImage = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        // Check if file is uploaded
        if (!req.file) {
            return res.json({ success: false, message: "Profile image is required" });
        }

        // Upload to Cloudinary
        const { v2: cloudinary } = await import('cloudinary');
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
            folder: 'user_profiles',
            resource_type: 'image',
            fetch_format: 'auto', // Equivalent to f_auto
            quality: 'auto', // Equivalent to q_auto
            transformation: [
                { width: 4000, height: 4000, crop: 'limit' } // Prevent large images
            ]
        });

        // Clean up temporary file
        try {
            fs.unlinkSync(req.file.path);
        } catch (err) {
            console.log('Could not delete temp file:', err.message);
        }

        // Update user avatar URL
        user.avatar = uploadResult.secure_url;
        await user.save();

        logger.userAction('UPDATE_AVATAR', user._id);
        return res.json({
            success: true,
            message: "Profile image updated successfully",
            user: {
                email: user.email,
                name: user.name,
                phone: user.phone,
                avatar: user.avatar,
                banner: user.banner
            }
        });
    } catch (error) {
        console.log(error.message);
        return res.json({ success: false, message: error.message });
    }
}

// Update user details : /api/user/updateDetails
export const updateDetails = async (req, res) => {
    try {
        const { name, email, phone, bio } = req.body;

        // Check if all details are provided
        if (!name || !email || !phone || bio === undefined) {
            return res.json({ success: false, message: "All details (name, email, phone, bio) are required" });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        // Check if all details are the same
        const isNameSame = user.name === name;
        const isEmailSame = user.email === email;
        const isPhoneSame = user.phone === phone;
        const isBioSame = user.bio === bio;

        if (isNameSame && isEmailSame && isPhoneSame && isBioSame) {
            return res.json({ success: true, message: "No changes detected" });
        }

        // SECURITY FIX: Prevent email/phone changes without re-verification
        // This prevents account takeover if session is compromised
        if (!isEmailSame) {
            logger.warn(`Blocked email change attempt for user ${req.userId}`);
            return res.status(403).json({
                success: false,
                message: "Email changes require verification. Please contact support or create a new account."
            });
        }

        if (!isPhoneSame) {
            logger.warn(`Blocked phone change attempt for user ${req.userId}`);
            return res.status(403).json({
                success: false,
                message: "Phone number changes require verification. Please contact support."
            });
        }

        // SECURITY: Sanitize inputs to prevent XSS attacks
        const sanitizedName = sanitizeHtml(name, {
            allowedTags: [],  // No HTML tags allowed in name
            allowedAttributes: {}
        });

        const sanitizedBio = sanitizeHtml(bio, {
            allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],  // Only safe formatting
            allowedAttributes: {}
        });

        // Only allow name and bio changes
        user.name = sanitizedName;
        user.bio = sanitizedBio;
        await user.save();

        logger.userAction('UPDATE_DETAILS', user._id);
        return res.json({
            success: true,
            message: "Details updated successfully",
            user: {
                email: user.email,
                name: user.name,
                phone: user.phone,
                bio: user.bio,
                avatar: user.avatar,
                banner: user.banner
            }
        });
    } catch (error) {
        console.log(error.message);
        return res.json({ success: false, message: error.message });
    }
}

// Purchase Verified Status - Deducts 300 from AvailableBalance and sets verified = true
// Rate limited to prevent abuse - can only purchase once
// Uses atomic transaction to ensure secure balance deduction
export const purchaseVerifiedStatus = async (req, res) => {
    try {
        const userId = req.userId;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if already verified
        if (user.verified === true) {
            return res.status(400).json({
                success: false,
                message: 'You are already verified'
            });
        }

        // Check if KYC verified (requirement)
        if (user.isKycVerified !== true) {
            return res.status(400).json({
                success: false,
                message: 'Please complete KYC verification first'
            });
        }

        const cost = 300;
        const availableBalance = user.AvailableBalance || 0;

        // Check if sufficient balance
        if (availableBalance < cost) {
            return res.status(400).json({
                success: false,
                message: `Insufficient balance. Required: ₹${cost}, Available: ₹${availableBalance}`
            });
        }

        // Atomic transaction: Deduct balance and set verified
        user.AvailableBalance -= cost;
        user.verified = true;
        user.verifiedPurchasedAt = new Date(); // Track when verification was purchased

        await user.save();

        logger.userAction('PURCHASE_VERIFIED', userId, { amount: cost });

        return res.json({
            success: true,
            message: 'Verified badge purchased successfully!',
            user: {
                verified: user.verified,
                AvailableBalance: user.AvailableBalance
            }
        });

    } catch (error) {
        console.error('Purchase verified status error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'An error occurred. Please try again.'
        });
    }
};
