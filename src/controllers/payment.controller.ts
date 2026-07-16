import { Response }      from "express";
import { AuthRequest }   from "../middleware/auth.middleware";
import { PickupRequest } from "../models/PickupRequest.model";
import { Payment }       from "../models/Payment.model";
import { User }          from "../models/User.model";
import {
  mockCollectPayment,
  mockPayoutToCollector,
  mockGetStatus,
} from "../services/mock-payment.service";

// ──────────────────────────────────────────────
// INITIATE PAYMENT
// ──────────────────────────────────────────────
export const initiatePayment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { pickupRequestId, payerPhone, medium } = req.body;
    if (!pickupRequestId || !payerPhone) {
      return res.status(400).json({
        message: "Missing required fields: pickupRequestId, payerPhone",
      });
    }

    const pickup = await PickupRequest.findById(pickupRequestId);
    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    if (pickup.residentId.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (pickup.paymentStatus !== "pending") {
      return res.status(400).json({ message: "Payment already processed" });
    }

    const externalId = `PICKUP_${pickupRequestId}_${Date.now()}`;

    // Create payment record (pending)
    const payment = new Payment({
      pickupRequestId,
      residentId: userId,
      amount: pickup.priceAgreed,
      currency: "XAF",
      paymentMethod: medium || "mobile money",
      payerPhone,
      status: "pending",
    });
    await payment.save();

    // Call mock payment service
    const result = await mockCollectPayment({
      amount: pickup.priceAgreed,
      phone: payerPhone,
      externalId,
    });

    // Update payment with transaction ID and status
    payment.fapshiTransId = result.transId;
    payment.fapshiReference = result.transId;
    payment.status = "held";
    await payment.save();

    // Update pickup
    pickup.paymentStatus = "held";
    pickup.escrowPaymentId = payment._id.toString();
    await pickup.save();

    return res.status(201).json({
      message: "Payment initiated (mock). Funds held in escrow.",
      payment,
      mockResponse: result,
    });
  } catch (error: any) {
    console.error("Initiate payment error:", error.message);
    return res.status(500).json({
      message: error.message || "Failed to initiate payment",
    });
  }
};

// ──────────────────────────────────────────────
// VERIFY PAYMENT
// ──────────────────────────────────────────────
export const verifyPayment = async (req: AuthRequest, res: Response) => {
  try {
    const transId = req.params.transId as string;
    if (!transId) {
      return res.status(400).json({ message: "Transaction ID required" });
    }

    const status = await mockGetStatus(transId);

    // Find and update payment if needed
    const payment = await Payment.findOne({ fapshiTransId: transId });
    if (payment) {
      if (status.status === "SUCCESSFUL" && payment.status === "pending") {
        payment.status = "held";
        await payment.save();
        await PickupRequest.findByIdAndUpdate(payment.pickupRequestId, {
          paymentStatus: "held",
          escrowPaymentId: payment._id.toString(),
        });
      } else if (status.status === "FAILED" || status.status === "EXPIRED") {
        payment.status = "failed";
        await payment.save();
        await PickupRequest.findByIdAndUpdate(payment.pickupRequestId, {
          paymentStatus: "failed",
        });
      }
    }

    return res.status(200).json({
      status: status.status,
      data: status,
    });
  } catch (error: any) {
    console.error("Verify payment error:", error.message);
    return res.status(500).json({
      message: error.message || "Failed to verify payment",
    });
  }
};

// ──────────────────────────────────────────────
// RELEASE PAYMENT
// ──────────────────────────────────────────────
export const releasePayment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId).populate("pickupRequestId");
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const pickup = payment.pickupRequestId as any;
    if (pickup.residentId.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (payment.status !== "held") {
      return res.status(400).json({ message: "Payment not in escrow" });
    }

    const collector = await User.findById(pickup.collectorId);
    if (!collector) {
      return res.status(404).json({ message: "Collector not found" });
    }

    const externalId = `PAYOUT_${payment._id}_${Date.now()}`;

    // Call mock payout
    const result = await mockPayoutToCollector({
      amount: payment.amount,
      phone: collector.phone,
      externalId,
    });

    // Update payment
    payment.status = "released";
    payment.payeePhone = collector.phone;
    payment.releasedAt = new Date();
    payment.disbursementTransactionId = result.transId;
    await payment.save();

    pickup.paymentStatus = "released";
    await pickup.save();

    return res.status(200).json({
      message: "Payment released to collector (mock payout successful).",
      payment,
      mockResponse: result,
    });
  } catch (error: any) {
    console.error("Release payment error:", error.message);
    return res.status(500).json({
      message: error.message || "Failed to release payment",
    });
  }
};

// ──────────────────────────────────────────────
// GET PAYMENT BY PICKUP ID
// ──────────────────────────────────────────────
export const getPaymentByPickup = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { pickupId } = req.params;
    const payment = await Payment.findOne({ pickupRequestId: pickupId })
      .populate("residentId", "name phone")
      .populate("collectorId", "name phone");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    return res.status(200).json({ payment });
  } catch (error: any) {
    console.error("Get payment error:", error.message);
    return res.status(500).json({ message: "Failed to get payment" });
  }
};

// ──────────────────────────────────────────────
// GET PAYMENT HISTORY
// ──────────────────────────────────────────────
export const getPaymentHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { limit = 20, page = 1 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const payments = await Payment.find({ residentId: userId })
      .populate("pickupRequestId", "neighbourhood addressDescription status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Payment.countDocuments({ residentId: userId });

    const history = payments.map((p) => {
      const pickup = p.pickupRequestId as any;
      return {
        id: p._id,
        date: p.createdAt,
        amount: p.amount,
        type: p.status === "refunded" ? "refund" : "pickup",
        status: p.status,
        description: pickup?.neighbourhood || "Pickup payment",
      };
    });

    return res.status(200).json({
      history,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Get payment history error:", error.message);
    return res.status(500).json({ message: "Failed to get payment history" });
  }
};

// ──────────────────────────────────────────────
// GET PAYMENT SUMMARY
// ──────────────────────────────────────────────
export const getPaymentSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const payments = await Payment.find({ residentId: userId });

    const totalBalance = payments
      .filter((p) => p.status === "released")
      .reduce((sum, p) => sum + p.amount, 0);

    const inEscrow = payments
      .filter((p) => p.status === "held")
      .reduce((sum, p) => sum + p.amount, 0);

    const pending = payments
      .filter((p) => p.status === "pending")
      .reduce((sum, p) => sum + p.amount, 0);

    return res.status(200).json({
      totalBalance,
      inEscrow,
      pending,
    });
  } catch (error: any) {
    console.error("Get payment summary error:", error.message);
    return res.status(500).json({ message: "Failed to get payment summary" });
  }
};