import { Request, Response } from "express";
import { getPaymentStatus }  from "../services/payunit.service";
import { Payment }           from "../models/Payment.model";
import { PickupRequest }     from "../models/PickupRequest.model";

// ─── PayUnit Webhook Handler ───
export const handlePayUnitWebhook = async (req: Request, res: Response) => {
  try {
    console.log("📩 PayUnit webhook raw payload:", JSON.stringify(req.body));

    // Get transaction id (try different possible field names)
    const payload = req.body as any;
    const transactionId =
      payload.transaction_id ||
      payload.transactionId ||
      payload.reference ||
      payload.txn_id;

    if (!transactionId) {
      console.warn("Webhook received with no recognizable transaction id");
      return res.status(200).json({ message: "Ignored — no transaction id" });
    }

    // Don't trust webhook status — re-fetch real status
    const realStatus = await getPaymentStatus(transactionId);

    const payment = await Payment.findOne({ payunitTransactionId: transactionId });
    if (!payment) {
      console.warn(`Payment not found locally for transaction: ${transactionId}`);
      return res.status(200).json({ message: "Payment not found locally" });
    }

    // Update based on real status
    if (realStatus && (realStatus.status === "SUCCESSFUL" || realStatus.status === "COMPLETED")) {
      payment.status = "held";
      await payment.save();
      await PickupRequest.findByIdAndUpdate(payment.pickupRequestId, {
        paymentStatus: "held",
        escrowPaymentId: payment._id,
      });
      console.log(`✅ Payment ${transactionId} held in escrow`);
    } else if (realStatus && realStatus.status === "FAILED") {
      payment.status = "failed";
      await payment.save();
      await PickupRequest.findByIdAndUpdate(payment.pickupRequestId, {
        paymentStatus: "failed",
      });
      console.log(`❌ Payment ${transactionId} failed`);
    }

    return res.status(200).json({ message: "Webhook processed" });
  } catch (error) {
    console.error("Webhook error:", error);
    // Still return 200 so PayUnit doesn't endlessly retry
    return res.status(200).json({ message: "Webhook error logged" });
  }
};

// ─── Disbursement Webhook Handler ───
export const handleDisbursementWebhook = async (req: Request, res: Response) => {
  try {
    console.log("📩 Disbursement webhook raw payload:", JSON.stringify(req.body));

    const payload = req.body as any;
    const transactionId =
      payload.transaction_id ||
      payload.transactionId ||
      payload.reference ||
      payload.txn_id;

    if (!transactionId) {
      console.warn("Disbursement webhook with no transaction id");
      return res.status(200).json({ message: "Ignored" });
    }

    // Find payment by disbursement transaction ID
    const payment = await Payment.findOne({
      disbursementTransactionId: transactionId,
    });

    if (!payment) {
      console.warn(`Disbursement payment not found: ${transactionId}`);
      return res.status(200).json({ message: "Not found locally" });
    }

    // Update status if needed
    const status = payload.status || payload.transaction_status;
    if (status === "SUCCESSFUL" || status === "COMPLETED") {
      payment.status = "released";
      await payment.save();
      console.log(`✅ Disbursement ${transactionId} completed`);
    } else if (status === "FAILED") {
      console.error(`❌ Disbursement ${transactionId} failed`);
    }

    return res.status(200).json({ message: "Disbursement webhook processed" });
  } catch (error) {
    console.error("Disbursement webhook error:", error);
    return res.status(200).json({ message: "Error logged" });
  }
};