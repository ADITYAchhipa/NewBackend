import Kyc from '../models/kyc.js';
import User from '../models/user.js';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

/**
 * Submit KYC verification
 * POST /api/identity-verification/submit
 * Expects multipart form data with:
 * - Personal info fields: firstName, lastName, dob, address, city, postalCode, country, documentType
 * - Files: frontId, backId (optional for passport), selfie
 */
export const submitKyc = async (req, res) => {
    try {
        const userId = req.userId;
        const {
            firstName,
            lastName,
            dob,
            address,
            city,
            postalCode,
            country,
            documentType
        } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !dob || !address || !city || !postalCode || !country || !documentType) {
            return res.json({ success: false, message: 'All personal information fields are required' });
        }

        // Validate document type
        if (!['passport', 'drivers_license', 'national_id'].includes(documentType)) {
            return res.json({ success: false, message: 'Invalid document type' });
        }

        // Get uploaded files
        const files = req.files || {};
        const frontIdFile = files.frontId?.[0];
        const backIdFile = files.backId?.[0];
        const selfieFile = files.selfie?.[0];

        // Validate required files
        if (!frontIdFile) {
            return res.json({ success: false, message: 'Front ID image is required' });
        }
        if (!selfieFile) {
            return res.json({ success: false, message: 'Selfie image is required' });
        }
        // Back ID is optional now
        // if (documentType !== 'passport' && !backIdFile) {
        //     return res.json({ success: false, message: 'Back ID image is required for this document type' });
        // }

        console.log(`Processing KYC submission for user: ${userId}`);

        // Upload images to Cloudinary
        let frontIdUrl, backIdUrl, selfieUrl;

        try {
            // Upload front ID
            console.log('Uploading front ID to Cloudinary...');
            const frontIdUpload = await cloudinary.uploader.upload(frontIdFile.path, {
                folder: 'kyc_documents/front_ids',
                resource_type: 'image',
                fetch_format: 'auto',
                quality: 'auto',
                transformation: [
                    { width: 4000, height: 4000, crop: 'limit' }
                ]
            });
            frontIdUrl = frontIdUpload.secure_url;
            console.log('Front ID uploaded:', frontIdUrl);

            // Clean up temp file
            try {
                fs.unlinkSync(frontIdFile.path);
            } catch (err) {
                console.log('Could not delete temp file:', err.message);
            }

            // Upload back ID (if provided)
            if (backIdFile) {
                console.log('Uploading back ID to Cloudinary...');
                const backIdUpload = await cloudinary.uploader.upload(backIdFile.path, {
                    folder: 'kyc_documents/back_ids',
                    resource_type: 'image',
                    fetch_format: 'auto',
                    quality: 'auto',
                    transformation: [
                        { width: 4000, height: 4000, crop: 'limit' }
                    ]
                });
                backIdUrl = backIdUpload.secure_url;
                console.log('Back ID uploaded:', backIdUrl);

                // Clean up temp file
                try {
                    fs.unlinkSync(backIdFile.path);
                } catch (err) {
                    console.log('Could not delete temp file:', err.message);
                }
            }

            // Upload selfie
            console.log('Uploading selfie to Cloudinary...');
            const selfieUpload = await cloudinary.uploader.upload(selfieFile.path, {
                folder: 'kyc_documents/selfies',
                resource_type: 'image',
                fetch_format: 'auto',
                quality: 'auto',
                transformation: [
                    { width: 4000, height: 4000, crop: 'limit' }
                ]
            });
            selfieUrl = selfieUpload.secure_url;
            console.log('Selfie uploaded:', selfieUrl);

            // Clean up temp file
            try {
                fs.unlinkSync(selfieFile.path);
            } catch (err) {
                console.log('Could not delete temp file:', err.message);
            }

        } catch (uploadError) {
            console.error('Cloudinary upload error:', uploadError);
            return res.json({ success: false, message: 'Failed to upload images. Please try again.' });
        }

        // Check if user already has a KYC record
        let kyc = await Kyc.findOne({ userId });

        if (kyc) {
            // Update existing record
            kyc.firstName = firstName;
            kyc.lastName = lastName;
            kyc.dob = dob;
            kyc.address = address;
            kyc.city = city;
            kyc.postalCode = postalCode;
            kyc.country = country;
            kyc.documentType = documentType;
            kyc.frontIdUrl = frontIdUrl;
            kyc.backIdUrl = backIdUrl || null;
            kyc.selfieUrl = selfieUrl;
            kyc.status = 'pending'; // Reset to pending on resubmission
            kyc.rejectionReason = null;
            kyc.submittedAt = new Date();
            kyc.verifiedAt = null;

            await kyc.save();
            console.log('KYC record updated for user:', userId);
        } else {
            // Create new record
            kyc = await Kyc.create({
                userId,
                firstName,
                lastName,
                dob,
                address,
                city,
                postalCode,
                country,
                documentType,
                frontIdUrl,
                backIdUrl: backIdUrl || null,
                selfieUrl,
                status: 'pending',
                submittedAt: new Date()
            });
            console.log('KYC record created for user:', userId);
        }

        // Update user's kyc status to 'pending'
        await User.findByIdAndUpdate(userId, { kyc: 'pending' });
        console.log('User kyc status updated to pending for user:', userId);

        return res.json({
            success: true,
            message: 'KYC verification submitted successfully',
            kyc: {
                id: kyc._id,
                status: kyc.status,
                submittedAt: kyc.submittedAt
            }
        });

    } catch (error) {
        console.error('KYC submission error:', error);
        return res.json({ success: false, message: error.message });
    }
};

/**
 * Get KYC status for current user
 * GET /api/identity-verification/status
 */
export const getKycStatus = async (req, res) => {
    try {
        const userId = req.userId;

        const kyc = await Kyc.findOne({ userId });

        if (!kyc) {
            return res.json({
                success: true,
                status: 'not_started',
                kyc: null
            });
        }

        return res.json({
            success: true,
            status: kyc.status,
            kyc: {
                id: kyc._id,
                firstName: kyc.firstName,
                lastName: kyc.lastName,
                documentType: kyc.documentType,
                status: kyc.status,
                rejectionReason: kyc.rejectionReason,
                submittedAt: kyc.submittedAt,
                verifiedAt: kyc.verifiedAt
            }
        });

    } catch (error) {
        console.error('Get KYC status error:', error);
        return res.json({ success: false, message: error.message });
    }
};

/**
 * Update KYC status (Admin function)
 * POST /api/identity-verification/update-status
 * Body: { kycId, status, rejectionReason (optional) }
 */
export const updateKycStatus = async (req, res) => {
    try {
        const { kycId, status, rejectionReason } = req.body;

        if (!kycId || !status) {
            return res.json({ success: false, message: 'KYC ID and status are required' });
        }

        if (!['pending', 'accepted', 'rejected'].includes(status)) {
            return res.json({ success: false, message: 'Invalid status. Must be pending, accepted, or rejected' });
        }

        const kyc = await Kyc.findById(kycId);

        if (!kyc) {
            return res.json({ success: false, message: 'KYC record not found' });
        }

        kyc.status = status;

        if (status === 'rejected' && rejectionReason) {
            kyc.rejectionReason = rejectionReason;
        } else {
            kyc.rejectionReason = null;
        }

        if (status === 'accepted') {
            kyc.verifiedAt = new Date();
        }

        await kyc.save();

        console.log(`KYC status updated to ${status} for KYC ID: ${kycId}`);

        return res.json({
            success: true,
            message: `KYC status updated to ${status}`,
            kyc: {
                id: kyc._id,
                status: kyc.status,
                verifiedAt: kyc.verifiedAt
            }
        });

    } catch (error) {
        console.error('Update KYC status error:', error);
        return res.json({ success: false, message: error.message });
    }
};

/**
 * Get all KYC submissions (Admin function)
 * GET /api/identity-verification/all
 * Query params: status (optional), page, limit
 */
export const getAllKyc = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;

        const query = {};
        if (status && ['pending', 'accepted', 'rejected'].includes(status)) {
            query.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [kycRecords, total] = await Promise.all([
            Kyc.find(query)
                .populate('userId', 'name email phone')
                .sort({ submittedAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Kyc.countDocuments(query)
        ]);

        return res.json({
            success: true,
            data: kycRecords,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Get all KYC error:', error);
        return res.json({ success: false, message: error.message });
    }
};
