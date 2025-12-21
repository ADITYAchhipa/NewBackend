import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads/images');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename: timestamp_originalname
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${timestamp}_${name}${ext}`);
    }
});

// File filter - only images
const fileFilter = (req, file, cb) => {
    console.log('📤 [FILE FILTER] Checking file:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        fieldname: file.fieldname,
        encoding: file.encoding
    });

    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    console.log('📤 [FILE FILTER] Validation results:', {
        extension: path.extname(file.originalname).toLowerCase(),
        extnameMatch: extname,
        mimetypeMatch: mimetype,
        actualMimetype: file.mimetype
    });

    // FIXED: Only check extension, not MIME type
    // MIME type from browser is unreliable (comes as application/octet-stream)
    // File extension is more reliable for validation
    if (extname) {
        console.log('✅ [FILE FILTER] File accepted based on extension');
        cb(null, true);
    } else {
        console.log('❌ [FILE FILTER] File REJECTED - invalid extension');
        cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed!'));
    }
};

// Create multer upload instance
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: fileFilter
});

export default upload;
