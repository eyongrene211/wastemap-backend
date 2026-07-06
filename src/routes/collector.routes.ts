import { Router }         from "express";
import {
  getCollectorProfile,
  updateCollectorProfile,
  toggleAvailability,
  getIncomingRequests,
  acceptJob,
  declineJob,
  markEnRoute,
  markComplete,
  getEarnings,
  getJobs,
} from "../controllers/collector.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { roleMiddleware } from "../middleware/role.middleware";

const router = Router();

// All collector routes require authentication and collector role
router.use(authMiddleware);
router.use(roleMiddleware(["collector"]));

// ─── Profile ───
router.get("/profile", getCollectorProfile);
router.put("/profile", updateCollectorProfile);

// ─── Availability ───
router.put("/availability", toggleAvailability);

// ─── Requests / Jobs ───
router.get("/requests", getIncomingRequests);
router.post("/requests/:id/accept", acceptJob);
router.post("/requests/:id/decline", declineJob);

// ─── Active Job ───
router.post("/jobs/:id/en-route", markEnRoute);
router.post("/jobs/:id/complete", markComplete);

// ─── History & Earnings ───
router.get("/jobs", getJobs);
router.get("/earnings", getEarnings);

export default router;