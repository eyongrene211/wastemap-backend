import mongoose, { Schema, Document } from "mongoose";

export interface IPayment extends Document {
  pickupRequestId: mongoose.Types.ObjectId;
  residentId: mongoose.Types.ObjectId;
  collectorId?: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  status: "pending" | "held" | "released" | "refunded" | "failed";
  fapshiTransId?: string;
  fapshiReference?: string;
  disbursementTransactionId?: string;
  paymentMethod: string;
  payerPhone: string;
  payeePhone?: string;
  webhookData?: any;
  releasedAt?: Date;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    pickupRequestId: {
      type: Schema.Types.ObjectId,
      ref: "PickupRequest",
      required: true,
    },
    residentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    collectorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "XAF",
    },
    status: {
      type: String,
      enum: ["pending", "held", "released", "refunded", "failed"],
      default: "pending",
    },
    fapshiTransId: {
      type: String,
    },
    fapshiReference: {
      type: String,
    },
    disbursementTransactionId: {
      type: String,
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    payerPhone: {
      type: String,
      required: true,
    },
    payeePhone: {
      type: String,
    },
    webhookData: {
      type: Schema.Types.Mixed,
    },
    releasedAt: {
      type: Date,
    },
    refundedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export const Payment = mongoose.model<IPayment>("Payment", PaymentSchema);