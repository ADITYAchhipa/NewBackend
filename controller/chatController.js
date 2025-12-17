import Message from "../models/message.js";
import User from "../models/user.js";
import { escapeRegex } from "../utils/security.js";

// Get list of users the current user has chatted with
export async function getChatContacts(req, res) {
    try {
        const userId = req.userId;

        // Get user's contact list
        const user = await User.findById(userId).select("propertyOwners");

        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        if (!user.propertyOwners || user.propertyOwners.length === 0) {
            return res.json({
                success: true,
                contacts: [],
                unseenMessages: {}
            });
        }

        // Optimized aggregation pipeline (replaces N+1 queries)
        const contactsData = await Message.aggregate([
            {
                // Match all messages involving this user and their contacts
                $match: {
                    $or: [
                        { senderId: userId, receiverId: { $in: user.propertyOwners } },
                        { senderId: { $in: user.propertyOwners }, receiverId: userId }
                    ]
                }
            },
            {
                // Sort by creation time (newest first)
                $sort: { createdAt: -1 }
            },
            {
                // Group by contact to get last message and unseen count
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ["$senderId", userId] },
                            "$receiverId",
                            "$senderId"
                        ]
                    },
                    lastMessage: { $first: "$$ROOT" },
                    unseenCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$receiverId", userId] },
                                        { $eq: ["$seen", false] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        // Get contact details
        const contactIds = user.propertyOwners;
        const contacts = await User.find({ _id: { $in: contactIds } })
            .select("_id name email avatar");

        // Build response with contacts and their message data
        const contactsMap = new Map(contactsData.map(c => [c._id.toString(), c]));
        const unseenMessages = {};

        const contactsWithLastMessage = contacts.map(contact => {
            const data = contactsMap.get(contact._id.toString());

            if (data?.unseenCount > 0) {
                unseenMessages[contact._id] = data.unseenCount;
            }

            return {
                _id: contact._id,
                name: contact.name,
                email: contact.email,
                avatar: contact.avatar,
                lastMessage: data?.lastMessage ? {
                    text: data.lastMessage.text,
                    image: data.lastMessage.image,
                    createdAt: data.lastMessage.createdAt,
                    isFromMe: data.lastMessage.senderId.toString() === userId.toString()
                } : null
            };
        });

        // Sort by last message time
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
            const uploadResponse = await cloudinary.uploader.upload(image, {
                fetch_format: 'auto',
                quality: 'auto',
                transformation: [
                    { width: 4000, height: 4000, crop: 'limit' }
                ]
            });
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
        // SECURITY: Escape regex to prevent ReDoS
        const safeQuery = escapeRegex(query);
        const users = await User.find({
            _id: { $ne: currentUserId }, // Exclude current user
            name: { $regex: safeQuery, $options: 'i' } // Case-insensitive substring match
        })
            .select("_id name email avatar")
            .limit(20);

        res.json({ success: true, users });
    } catch (error) {
        console.log("searchUsers error:", error.message);
        res.json({ success: false, message: error.message });
    }
}
