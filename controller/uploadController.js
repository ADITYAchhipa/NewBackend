// Upload Controller - Handles file uploads
export const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Return the URL where the image can be accessed
        const imageUrl = `/uploads/images/${req.file.filename}`;

        res.status(200).json({
            success: true,
            message: 'Image uploaded successfully',
            url: imageUrl,
            filename: req.file.filename
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload image',
            error: error.message
        });
    }
};

export const uploadMultipleImages = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files uploaded'
            });
        }

        // Return URLs for all uploaded images
        const urls = req.files.map(file => `/uploads/images/${file.filename}`);

        res.status(200).json({
            success: true,
            message: `${req.files.length} images uploaded successfully`,
            urls: urls
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload images',
            error: error.message
        });
    }
};
