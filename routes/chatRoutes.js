import { Router } from 'express';
import authUser from '../middleware/authUser.js';
import rateLimit from 'express-rate-limit';
import {
    getChatContacts,
    getMessages,
    sendMessage,
    markMessageAsSeen,
    searchUsers
} from '../controller/chatController.js';

const chatRouter = Router();

// Rate limiter for sending messages (prevent spam)
const messageRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 messages per minute
    message: {
        success: false,
        message: 'Too many messages sent. Please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Get list of chat contacts (users you've messaged)
chatRouter.get('/contacts', authUser, getChatContacts);

// Search users by name
chatRouter.get('/search', authUser, searchUsers);

// Get messages with a specific user
chatRouter.get('/messages/:id', authUser, getMessages);

// Send a message to a specific user (with rate limiting)
chatRouter.post('/send/:id', authUser, messageRateLimiter, sendMessage);

// Mark a message as seen
chatRouter.post('/seen/:id', authUser, markMessageAsSeen);

export default chatRouter;
