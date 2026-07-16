import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  pickupRequestId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  content: string;
  readAt?: Date;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    pickupRequestId: {
      type: Schema.Types.ObjectId,
      ref: "PickupRequest",
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

// ✅ Indexes for faster queries
MessageSchema.index({ pickupRequestId: 1, createdAt: 1 });
MessageSchema.index({ senderId: 1, receiverId: 1 });
MessageSchema.index({ readAt: 1 });

export const Message = mongoose.model<IMessage>("Message", MessageSchema);