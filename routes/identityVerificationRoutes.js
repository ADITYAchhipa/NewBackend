import express from 'express';
import { submitKyc, getKycStatus, updateKycStatus, getAllKyc } from '../controller/kycController.js';
import authUser from '../middleware/authUser.js';
import { upload } from '../config/multer.js';

const identityVerificationRouter = express.Router();

console.log("Identity Verification Routes Loaded");

// User routes (require authentication)

// Submit KYC verification with document images
// POST /api/identity-verification/submit
// Expects multipart data with fields and files (frontId, backId, selfie)
identityVerificationRouter.post(
    '/submit',
    authUser,
    upload.fields([
        { name: 'frontId', maxCount: 1 },
        { name: 'backId', maxCount: 1 },
        { name: 'selfie', maxCount: 1 }
    ]),
    submitKyc
);

// Get current user's KYC status
// GET /api/identity-verification/status
identityVerificationRouter.get('/status', authUser, getKycStatus);

// Admin routes (these will need admin middleware later)

// Update KYC status (accept/reject)
// POST /api/identity-verification/update-status
// Body: { kycId, status, rejectionReason }
identityVerificationRouter.post('/update-status', authUser, updateKycStatus);

// Get all KYC submissions (for admin dashboard)
// GET /api/identity-verification/all?status=pending&page=1&limit=20
identityVerificationRouter.get('/all', authUser, getAllKyc);

export default identityVerificationRouter;
