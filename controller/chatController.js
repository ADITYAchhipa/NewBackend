import Message from "../models/message.js";
import User from "../models/user.js";

// Get list of users the current user has chatted with
export async function getChatContacts(req, res) {
    try {
        const userId = req.userId;

        // Get user with populated propertyOwners
        const user = await User.findById(userId)
            .select("propertyOwners")
            .populate("propertyOwners", "_id name email avatar");

        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        // Get unseen message counts for each contact
        const unseenMessages = {};
        const contactsWithLastMessage = [];

        for (const contact of user.propertyOwners || []) {
            // Count unseen messages from this contact
            const unseenCount = await Message.countDocuments({
                senderId: contact._id,
                receiverId: userId,
                seen: false
            });

            if (unseenCount > 0) {
                unseenMessages[contact._id] = unseenCount;
            }

            // Get the last message between the two users
            const lastMessage = await Message.findOne({
                $or: [
                    { senderId: userId, receiverId: contact._id },
                    { senderId: contact._id, receiverId: userId }
                ]
            }).sort({ createdAt: -1 });

            contactsWithLastMessage.push({
                _id: contact._id,
                name: contact.name,
                email: contact.email,
                avatar: contact.avatar,
                lastMessage: lastMessage ? {
                    text: lastMessage.text,
                    image: lastMessage.image,
                    createdAt: lastMessage.createdAt,
                    isFromMe: lastMessage.senderId.toString() === userId.toString()
                } : null
            });
        }

        // Sort contacts by last message time (most recent first)
        contactsWithLastMessage.sort((a, b) => {
            if (!a.lastMessage) return 1;
            if (!b.lastMessage) return -1;
            return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
        });

        res.json({
            success: true,
            contacts: contactsWithLastMessage,
            unseenMessages
        });
    } catch (error) {
        console.log("getChatContacts error:", error.message);
        res.json({ success: false, message: error.message });
    }
}

// Get messages between current user and another user (with pagination)
export async function getMessages(req, res) {
    try {
        const { id: selectedUserId } = req.params;
        const myId = req.userId;
        const limit = parseInt(req.query.limit) || 30;
        const before = req.query.before; // ISO date string for cursor-based pagination

        // Build query
        const query = {
            $or: [
                { senderId: myId, receiverId: selectedUserId },
                { senderId: selectedUserId, receiverId: myId },
            ]
        };

        // If 'before' is provided, get messages before that timestamp
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        // Get total count (without pagination)
        const total = await Message.countDocuments({
            $or: [
                { senderId: myId, receiverId: selectedUserId },
                { senderId: selectedUserId, receiverId: myId },
            ]
        });

        // Get paginated messages (most recent first for pagination, then reverse)
        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(limit);

        // Reverse to get chronological order
        messages.reverse();

        // Mark messages from the selected user as seen
        const updatedCount = await Message.updateMany(
            { senderId: selectedUserId, receiverId: myId, seen: false },
            { seen: true }
        );

        res.json({
            success: true,
            messages,
            total,
            hasMore: messages.length === limit,
            markedAsSeen: updatedCount.modifiedCount || 0
        });
    } catch (error) {
        console.log("getMessages error:", error.message);
        res.json({ success: false, message: error.message });
    }
}

// Send a message to another user
export async function sendMessage(req, res) {
    try {
        const { text, image } = req.body;
        const receiverId = req.params.id;
        const senderId = req.userId;

        let imageUrl;
        if (image) {
            const { v2: cloudinary } = await import('cloudinary');
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        const newMessage = await Message.create({
            senderId,
            receiverId,
            text,
            image: imageUrl
        });

        // Add receiver to sender's propertyOwners if not already present
        await User.findByIdAndUpdate(
            senderId,
            { $addToSet: { propertyOwners: receiverId } }
        );

        // Add sender to receiver's propertyOwners if not already present
        await User.findByIdAndUpdate(
            receiverId,
            { $addToSet: { propertyOwners: senderId } }
        );

        // Emit socket event if receiver is online (handled in server.js)
        const io = req.app.get('io');
        const userSocketMap = req.app.get('userSocketMap');

        if (io && userSocketMap) {
            const receiverSocketId = userSocketMap[receiverId];
            if (receiverSocketId) {
                // Get sender name for first-time connection notifications
                const sender = await User.findById(senderId).select('name');
                const messageWithSender = {
                    ...newMessage.toObject(),
                    senderName: sender?.name || 'Someone'
                };
                io.to(receiverSocketId).emit("newMessage", messageWithSender);
            }
        }

        res.json({ success: true, newMessage });
    } catch (error) {
        console.log("sendMessage error:", error.message);
        res.json({ success: false, message: error.message });
    }
}

// Mark a message as seen
export async function markMessageAsSeen(req, res) {
    try {
        const { id } = req.params;
        await Message.findByIdAndUpdate(id, { seen: true });
        res.json({ success: true });
    } catch (error) {
        console.log("markMessageAsSeen error:", error.message);
        res.json({ success: false, message: error.message });
    }
}

// Search for users by name
export async function searchUsers(req, res) {
    try {
        const { query } = req.query;
        const currentUserId = req.userId;

        if (!query || query.trim().length === 0) {
            return res.json({ success: true, users: [] });
        }

        // Search for users whose name contains the query (case-insensitive)
        const users = await User.find({
            _id: { $ne: currentUserId }, // Exclude current user
            name: { $regex: query, $options: 'i' } // Case-insensitive substring match
        })
            .select("_id name email avatar")
            .limit(20);

        res.json({ success: true, users });
    } catch (error) {
        console.log("searchUsers error:", error.message);
        res.json({ success: false, message: error.message });
    }
}
