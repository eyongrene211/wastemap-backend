import { Router }         from "express";
import {
  initiatePayment,
  verifyPayment,
  releasePayment,
  getPaymentByPickup,
  getPaymentHistory,
  getPaymentSummary,
} from "../controllers/payment.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// All payment routes are protected
router.use(authMiddleware);

// ─── Payment Actions ───
router.post("/initiate", initiatePayment);
router.post("/release/:paymentId", releasePayment);
router.get("/verify/:transId", verifyPayment);

// ─── Payment Queries ───
router.get("/pickup/:pickupId", getPaymentByPickup);
router.get("/history", getPaymentHistory);
router.get("/summary", getPaymentSummary);

export default router;