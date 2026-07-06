import { Router }         from "express";
import {
  createPickupRequest,
  getPickups,
  getPickupDetail,
  confirmPickup,
  cancelPickup,
  getChatMessages,
  sendChatMessage,
} from "../controllers/resident.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { roleMiddleware } from "../middleware/role.middleware";

const router = Router();

// All resident routes require authentication and resident role
router.use(authMiddleware);
router.use(roleMiddleware(["resident"]));

// ─── Pickup Routes ───
router.post("/requests", createPickupRequest);
router.get("/requests", getPickups);
router.get("/requests/:id", getPickupDetail);
router.post("/requests/:id/confirm", confirmPickup);
router.post("/requests/:id/cancel", cancelPickup);

// ─── Chat Routes ───
router.get("/requests/:id/chat", getChatMessages);
router.post("/requests/:id/chat", sendChatMessage);

export default router;