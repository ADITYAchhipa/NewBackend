import { Schema, model } from 'mongoose';

const MessageSchema = new Schema({
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    text: { type: String },
    image: { type: String }, // Cloudinary URL for image attachments
    seen: { type: Boolean, default: false },
}, { timestamps: true });

// Compound index for efficient message retrieval between two users
MessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });

export default model('Message', MessageSchema);
