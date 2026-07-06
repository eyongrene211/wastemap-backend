import { Router }         from "express";
import {
  getStats,
  getUsers,
  suspendUser,
  getPendingKYC,
  approveKYC,
  rejectKYC,
  getAllPickups,
  getAllChats,
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
router.put("/users/:id/suspend", suspendUser);

// ─── KYC ───
router.get("/kyc", getPendingKYC);
router.post("/kyc/:id/approve", approveKYC);
router.post("/kyc/:id/reject", rejectKYC);

// ─── Pickups ───
router.get("/pickups", getAllPickups);

// ─── Chat ───
router.get("/chat", getAllChats);

// ─── Reports ───
router.get("/reports", getReports);

export default router;