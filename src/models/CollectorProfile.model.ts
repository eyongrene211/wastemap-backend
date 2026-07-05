import mongoose, { Schema, Document } from "mongoose";

export interface ICollectorProfile extends Document {
  userId: mongoose.Types.ObjectId;
  vehicleType: "tricycle" | "truck" | "pickup" | "wheelbarrow" | "other";
  acceptedWasteTypes: string[];
  serviceArea: {
    type: string;
    coordinates: number[][][];
  };
  priceRangeMin: number;
  priceRangeMax: number;
  bio?: string;
  profilePhoto?: string;
  kycStatus: "pending" | "approved" | "rejected";
  kycRejectionReason?: string;
  availability: "online" | "offline";
  capacityLimit: number;
  activeJobs: number;
  rating: number;
  totalRatings: number;
  completedJobs: number;
  currentLocation?: {
    lat: number;
    lng: number;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const CollectorProfileSchema = new Schema<ICollectorProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    vehicleType: {
      type: String,
      enum: ["tricycle", "truck", "pickup", "wheelbarrow", "other"],
      required: true,
    },
    acceptedWasteTypes: {
      type: [String],
      default: [],
    },
    serviceArea: {
      type: {
        type: String,
        enum: ["Polygon"],
        default: "Polygon",
      },
      coordinates: {
        type: [[[Number]]],
        default: [],
      },
    },
    priceRangeMin: {
      type: Number,
      required: true,
      default: 500,
    },
    priceRangeMax: {
      type: Number,
      required: true,
      default: 2000,
    },
    bio: {
      type: String,
      trim: true,
    },
    profilePhoto: {
      type: String,
    },
    kycStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    kycRejectionReason: {
      type: String,
    },
    availability: {
      type: String,
      enum: ["online", "offline"],
      default: "offline",
    },
    capacityLimit: {
      type: Number,
      default: 2,
    },
    activeJobs: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 0,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    completedJobs: {
      type: Number,
      default: 0,
    },
    currentLocation: {
      lat: { type: Number },
      lng: { type: Number },
      updatedAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

export const CollectorProfile = mongoose.model<ICollectorProfile>(
  "CollectorProfile",
  CollectorProfileSchema
);
