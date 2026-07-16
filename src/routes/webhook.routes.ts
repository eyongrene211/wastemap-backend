import { Router } from "express";
import {
  handlePayUnitWebhook,
  handleDisbursementWebhook,
} from "../controllers/webhook.controller";

const router = Router();

// ─── Public Webhook Routes (no auth) ───
router.post("/payunit", handlePayUnitWebhook);
router.post("/payunit-disbursement", handleDisbursementWebhook);

export default router;