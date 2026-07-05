import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  phone: string;
  email?: string;
  passwordHash?: string;
  name: string;
  role: "resident" | "collector" | "admin";
  city?: string;
  neighbourhood?: string;
  language: "en" | "fr";
  isVerified: boolean;
  isSuspended: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
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
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>("User", UserSchema);
