import jwt from 'jsonwebtoken';
import 'dotenv/config';
import User from '../models/user.js';
import logger from '../utils/logger.js';

const authUser = async (req, res, next) => {
    // Support JWT from either cookie or Authorization header (Bearer)
    let token = req.cookies?.token;
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    }
    if (!token) {
        return res.json({ success: false, message: "Not Authorized" })
    }
    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
        if (tokenDecode.id) {
            // SECURITY: Verify token version to invalidate old sessions
            const user = await User.findById(tokenDecode.id).select('tokenVersion');

            if (!user) {
                return res.json({ success: false, message: 'User not found' });
            }

            // Check if token version matches (invalidates on password change/logout-all)
            const tokenVersion = tokenDecode.v || 0;
            const currentVersion = user.tokenVersion || 0;

            if (tokenVersion !== currentVersion) {
                logger.warn(`Invalid token version for user ${tokenDecode.id}`);
                return res.json({
                    success: false,
                    message: 'Session expired. Please login again.'
                });
            }

            req.userId = tokenDecode.id;
        }
        else {
            return res.json({ success: false, message: 'Not Authorized' })
        }
        next()
    }
    catch (error) {
        console.log("error")
        res.json({ success: false, message: error.message })
    }
}

export default authUser;