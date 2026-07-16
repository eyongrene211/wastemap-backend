import { Router }         from "express";
import {
  getStats,
  getRecentActivity,
  getUsers,
  getUserDetail,
  toggleSuspendUser,
  suspendUser,
  activateUser,
  getPendingKYC,
  approveKYC,
  rejectKYC,
  getPickups,
  getAllPickups,
  getPickupDetail,
  getChatConversations,
  getChatMessages,
  getReports,
  getSettings,
  updateSettings,
} from "../controllers/admin.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { roleMiddleware } from "../middleware/role.middleware";

const router = Router();

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(roleMiddleware(["admin"]));

// ─── Dashboard ───
router.get("/stats", getStats);
router.get("/recent-activity", getRecentActivity);

// ─── Users ───
router.get("/users", getUsers);
router.get("/users/:id", getUserDetail);
router.put("/users/:id/suspend", toggleSuspendUser); // unified suspend/activate
// Legacy endpoints (kept for compatibility)
router.put("/users/:id/suspend", suspendUser);
router.put("/users/:id/activate", activateUser);

// ─── KYC ───
router.get("/kyc/pending", getPendingKYC);
router.post("/kyc/:id/approve", approveKYC);
router.post("/kyc/:id/reject", rejectKYC);

// ─── Pickups ───
router.get("/pickups", getPickups);
router.get("/pickups/all", getAllPickups); // legacy alias
router.get("/pickups/:id", getPickupDetail);

// ─── Chat ───
router.get("/chat/conversations", getChatConversations);
router.get("/chat/messages/:pickupId", getChatMessages);

// ─── Reports ───
router.get("/reports", getReports);

// ─── Settings ───
router.get("/settings", getSettings);
router.put("/settings", updateSettings);

export default router;