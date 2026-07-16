import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  phone: string;
  passwordHash?: string;
  name: string;
  role: "resident" | "collector" | "admin";
  city?: string;
  neighbourhood?: string;
  language: "en" | "fr";
  isVerified: boolean;
  isSuspended: boolean;
  avatar?: string;
  notificationPrefs?: {
    sms: boolean;
    push: boolean;
    reminders: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    passwordHash: {
      type: String,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["resident", "collector", "admin"],
      default: "resident",
    },
    city: {
      type: String,
      trim: true,
    },
    neighbourhood: {
      type: String,
      trim: true,
    },
    language: {
      type: String,
      enum: ["en", "fr"],
      default: "en",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
      trim: true,
    },
    notificationPrefs: {
      sms: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: true,
      },
      reminders: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>("User", UserSchema);