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
import { getUserBookings } from '../controller/bookingController.js';
import authUser from '../middleware/authUser.js';
import { upload } from '../config/multer.js';
import { otpRateLimiter, loginRateLimiter } from '../middleware/rateLimiter.js';
import { verifyCaptcha, validateFingerprint, progressiveDelay, sanitizeInput } from '../middleware/security.js';
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
// Step 1: Request OTP - rate limited (3/hour) + captcha verified + validated
userRouter.post('/request-otp', validateRegistration, otpRateLimiter, verifyCaptcha, validateFingerprint, requestOtp);

// Step 2: Verify OTP and complete registration - with progressive delay
userRouter.post('/verify-otp', validateOtpVerification, progressiveDelay, verifyAndRegister);

// Legacy OTP routes (deprecated, kept for backward compatibility)
userRouter.post('/otp', otpRateLimiter, otp);
userRouter.post('/verify', verify);

// Login - validated + rate limited + progressive delay on failed attempts
userRouter.post('/login', validateLogin, loginRateLimiter, progressiveDelay, login);

// Forgot Password
userRouter.post('/ForgotPassword', validateEmail, otpRateLimiter, forgot);
userRouter.post('/forgot', validateEmail, otpRateLimiter, forgot); // alias for lowercase route

// Logout
userRouter.post('/logout', logout);

// ============ PROTECTED ROUTES (Require Authentication) ============

// Auth check
userRouter.get('/is-auth', authUser, isAuth);

// Password management
userRouter.post('/ChangePasswordProfile', authUser, changePasswordProfile);
userRouter.post('/resetPassword', authUser, resetPassword);

// Profile updates
userRouter.post('/updateCountry', authUser, updateCountry);
userRouter.post('/updateBanner', authUser, upload.single('banner'), updateBanner);
userRouter.post('/updateProfileImage', authUser, upload.single('profile'), updateProfileImage);
userRouter.post('/updateDetails', authUser, updateDetails);

// Bookings
userRouter.get('/bookings', authUser, getUserBookings);

export default userRouter;
