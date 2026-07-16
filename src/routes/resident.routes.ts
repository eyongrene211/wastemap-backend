import { Router }         from "express";
import {
  getDashboard,
  createPickupRequest,
  getPickups,
  getPickupDetail,
  confirmPickup,
  cancelPickup,
  getProfile,
  updateProfile,
  getPayments,
  getAvailableCollectors,
  getChatMessages,
  sendChatMessage,
} from "../controllers/resident.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { roleMiddleware } from "../middleware/role.middleware";

const router = Router();

// All resident routes require authentication and resident role
router.use(authMiddleware);
router.use(roleMiddleware(["resident"]));

// ─── Dashboard ───
router.get("/dashboard", getDashboard);

// ─── Pickup Routes ───
router.post("/requests", createPickupRequest);
router.get("/requests", getPickups);
router.get("/requests/:id", getPickupDetail);
router.post("/requests/:id/confirm", confirmPickup);
router.post("/requests/:id/cancel", cancelPickup);

// ─── Profile Routes ───
router.get("/profile", getProfile);
router.put("/profile", updateProfile);

// ─── Payment Routes ───
router.get("/payments", getPayments);

// ─── Collectors ───
router.get("/collectors", getAvailableCollectors);

// ─── Chat Routes ───
router.get("/requests/:id/chat", getChatMessages);
router.post("/requests/:id/chat", sendChatMessage);

export default router;