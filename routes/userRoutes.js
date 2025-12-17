import express from 'express'
import {
    register,
    login,
    isAuth,
    logout,
    otp,
    verify,
    forgot,
    resetPassword,
    changePasswordProfile,
    updateCountry,
    updateBanner,
    updateProfileImage,
    updateDetails,
    requestOtp,
    verifyAndRegister
} from '../controller/userController.js';
import { logoutAll } from '../controller/logoutAllController.js';
import { getUserBookings } from '../controller/bookingController.js';
import authUser from '../middleware/authUser.js';
import { upload } from '../config/multer.js';
import { otpRateLimiter, loginRateLimiter } from '../middleware/rateLimiter.js';
import { globalOtpRateLimiter } from '../middleware/otpRateLimiter.js';
import { verifyCaptcha, validateFingerprint, progressiveDelay, sanitizeInput } from '../middleware/security.js';
import { csrfProtect } from '../middleware/csrfProtection.js';
import {
    preventNoSQLInjection,
    sanitizeRequest,
    validateRegistration,
    validateLogin,
    validateEmail,
    validateOtpVerification
} from '../middleware/inputValidator.js';

const userRouter = express.Router();
console.log("User Routes Loaded");

// Apply security middleware to all routes
userRouter.use(preventNoSQLInjection); // Block NoSQL injection attempts
userRouter.use(sanitizeRequest); // Deep sanitize all inputs
userRouter.use(sanitizeInput); // Legacy sanitization (kept for compatibility)

// ============ PUBLIC ROUTES ============

// Registration (legacy - direct registration, kept for backward compatibility)
userRouter.post('/register', validateRegistration, register);

// NEW: Secure OTP-based registration flow
// Step 1: Request OTP - with GLOBAL rate limiting (prevents distributed attacks)
userRouter.post('/request-otp', validateRegistration, globalOtpRateLimiter, otpRateLimiter, verifyCaptcha, validateFingerprint, requestOtp);

// Step 2: Verify OTP and complete registration - with progressive delay
userRouter.post('/verify-otp', validateOtpVerification, progressiveDelay, verifyAndRegister);

// Legacy OTP routes (deprecated, kept for backward compatibility)
userRouter.post('/otp', globalOtpRateLimiter, otpRateLimiter, otp);
userRouter.post('/verify', verify);

// Login - validated + rate limited + progressive delay on failed attempts
userRouter.post('/login', validateLogin, loginRateLimiter, progressiveDelay, login);

// Forgot Password - with GLOBAL OTP rate limiting
userRouter.post('/ForgotPassword', validateEmail, globalOtpRateLimiter, otpRateLimiter, forgot);
userRouter.post('/forgot', validateEmail, globalOtpRateLimiter, otpRateLimiter, forgot); // alias for lowercase route

// Logout (CSRF protected - state-changing operation)
userRouter.post('/logout', csrfProtect, logout);

// ============ PROTECTED ROUTES (Require Authentication) ============

// Auth check
userRouter.get('/is-auth', authUser, isAuth);

// Password management (CSRF protected - critical operations)
userRouter.post('/ChangePasswordProfile', authUser, csrfProtect, changePasswordProfile);
userRouter.post('/resetPassword', authUser, csrfProtect, resetPassword);

// Profile updates (CSRF protected - state-changing operations)
userRouter.post('/updateCountry', authUser, csrfProtect, updateCountry);
userRouter.post('/updateBanner', authUser, csrfProtect, upload.single('banner'), updateBanner);
userRouter.post('/updateProfileImage', authUser, csrfProtect, upload.single('profile'), updateProfileImage);
userRouter.post('/updateDetails', authUser, csrfProtect, updateDetails);

// Logout from all devices (CSRF protected)
userRouter.post('/logout-all', authUser, csrfProtect, logoutAll);

// Bookings
userRouter.get('/bookings', authUser, getUserBookings);

export default userRouter;
