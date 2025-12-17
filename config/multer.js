

import multer from 'multer';

// File filter to block SVG uploads and only allow safe image formats
const fileFilter = (req, file, cb) => {
    // Allowed MIME types
    const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp'
    ];

    // Block SVG explicitly
    if (file.mimetype === 'image/svg+xml' || file.mimetype === 'image/svg') {
        return cb(new Error('SVG files are not allowed for security reasons'), false);
    }

    // Check if file type is allowed
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type not allowed. Only JPG, JPEG, PNG, and WebP are accepted.`), false);
    }
};

export const upload = multer({
    storage: multer.diskStorage({}),
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB file size limit
    }
});

