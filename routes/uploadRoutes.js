import express from 'express';
import upload from '../middleware/upload.js';
import { uploadImage, uploadMultipleImages } from '../controller/uploadController.js';
import authUser from '../middleware/authUser.js';

const router = express.Router();

// Upload single image
router.post('/image', authUser, upload.single('image'), uploadImage);

// Upload multiple images (max 10)
router.post('/images', authUser, upload.array('images', 10), uploadMultipleImages);

export default router;
