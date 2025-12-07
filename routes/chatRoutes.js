import { Router } from 'express';
import authUser from '../middleware/authUser.js';
import {
    getChatContacts,
    getMessages,
    sendMessage,
    markMessageAsSeen,
    searchUsers
} from '../controller/chatController.js';

const chatRouter = Router();

// Get list of chat contacts (users you've messaged)
chatRouter.get('/contacts', authUser, getChatContacts);

// Search users by name
chatRouter.get('/search', authUser, searchUsers);

// Get messages with a specific user
chatRouter.get('/messages/:id', authUser, getMessages);

// Send a message to a specific user
chatRouter.post('/send/:id', authUser, sendMessage);

// Mark a message as seen
chatRouter.post('/seen/:id', authUser, markMessageAsSeen);

export default chatRouter;
