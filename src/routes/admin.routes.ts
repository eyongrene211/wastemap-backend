import { Router }         from "express";
import {
  getStats,
  getUsers,
  getUserDetail,
  suspendUser,
  activateUser,
  getPendingKYC,
  approveKYC,
  rejectKYC,
  getAllPickups,
  getPickupDetail as adminPickupDetail,
  getChatConversations,
  getChatMessages,
  getReports,
} from "../controllers/admin.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { roleMiddleware } from "../middleware/role.middleware";

const router = Router();

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(roleMiddleware(["admin"]));

// ─── Dashboard ───
router.get("/stats", getStats);

// ─── Users ───
router.get("/users", getUsers);
router.get("/users/:id", getUserDetail);
router.put("/users/:id/suspend", suspendUser);
router.put("/users/:id/activate", activateUser);

// ─── KYC ───
router.get("/kyc/pending", getPendingKYC);
router.post("/kyc/:id/approve", approveKYC);
router.post("/kyc/:id/reject", rejectKYC);

// ─── Pickups ───
router.get("/pickups", getAllPickups);
router.get("/pickups/:id", adminPickupDetail);

// ─── Chat ───
router.get("/chat/conversations", getChatConversations);
router.get("/chat/messages/:pickupId", getChatMessages);

// ─── Reports ───
router.get("/reports", getReports);

export default router;