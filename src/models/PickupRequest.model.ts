import mongoose, { Schema, Document } from "mongoose";

export interface IPickupRequest extends Document {
  residentId: mongoose.Types.ObjectId;
  collectorId?: mongoose.Types.ObjectId;
  location: {
    type: string;
    coordinates: [number, number];
  };
  addressDescription: string;
  neighbourhood: string;
  city: string;
  wasteTypes: string[];
  notes?: string;
  photoUrl?: string;
  status:
    | "pending"
    | "assigned"
    | "en_route"
    | "arrived"
    | "completed"
    | "cancelled"
    | "disputed";
  type: "direct" | "open";
  scheduledDate?: Date;
  scheduledTimeSlot?: "morning" | "afternoon" | "evening";
  priceAgreed: number;
  escrowPaymentId?: string;
  paymentStatus: "pending" | "held" | "released" | "refunded";
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PickupRequestSchema = new Schema<IPickupRequest>(
  {
    residentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    collectorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    addressDescription: {
      type: String,
      required: true,
      trim: true,
    },
    neighbourhood: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    wasteTypes: {
      type: [String],
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    photoUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "assigned", "en_route", "arrived", "completed", "cancelled", "disputed"],
      default: "pending",
    },
    type: {
      type: String,
      enum: ["direct", "open"],
      default: "direct",
    },
    scheduledDate: {
      type: Date,
    },
    scheduledTimeSlot: {
      type: String,
      enum: ["morning", "afternoon", "evening"],
    },
    priceAgreed: {
      type: Number,
      required: true,
    },
    escrowPaymentId: {
      type: String,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "held", "released", "refunded"],
      default: "pending",
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

PickupRequestSchema.index({ location: "2dsphere" });

export const PickupRequest = mongoose.model<IPickupRequest>(
  "PickupRequest",
  PickupRequestSchema
);
