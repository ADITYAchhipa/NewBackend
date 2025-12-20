import jwt from 'jsonwebtoken';
import 'dotenv/config';
import User from '../models/user.js';

/**
 * Optional Authentication Middleware
 * 
 * Unlike authUser, this middleware allows requests to proceed even without a token.
 * If token is present and valid, sets req.userId.
 * If no token or invalid token, sets req.userId = null and continues.
 * 
 * Use this for routes that work with or without authentication
 * (e.g., recommendations can show personalized results for logged-in users
 * or generic popular items for anonymous users)
 */
const optionalAuth = async (req, res, next) => {
    // Default to null (anonymous user)
    req.userId = null;

    // Support JWT from either cookie or Authorization header (Bearer)
    let token = req.cookies?.token;
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    }

    // No token - continue as anonymous
    if (!token) {
        return next();
    }

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
        if (tokenDecode.id) {
            // Verify token version to invalidate old sessions
            const user = await User.findById(tokenDecode.id).select('tokenVersion');

            if (!user) {
                // User deleted but token still valid - continue as anonymous
                return next();
            }

            // Check if token version matches (invalidates on password change/logout-all)
            const tokenVersion = tokenDecode.v || 0;
            const currentVersion = user.tokenVersion || 0;

            if (tokenVersion !== currentVersion) {
                // Token version mismatch - continue as anonymous
                return next();
            }

            // Valid token - set userId
            req.userId = tokenDecode.id;
        }
        next();
    } catch (error) {
        // Invalid token - continue as anonymous
        next();
    }
};

export default optionalAuth;
