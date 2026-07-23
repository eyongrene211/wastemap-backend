import { Router }         from "express";
import multer             from "multer";
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
  getJobById,                // ✅ NEW: Import getJobById
  getJobChatMessages,
  sendJobChatMessage,
  submitKYC,
} from "../controllers/collector.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { roleMiddleware } from "../middleware/role.middleware";

const router = Router();

const kycUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

// All collector routes require authentication and collector role
router.use(authMiddleware);
router.use(roleMiddleware(["collector"]));

// ─── Profile ───
router.get("/profile", getCollectorProfile);
router.put("/profile", updateCollectorProfile);

// ─── KYC ───
router.post(
  "/kyc/submit",
  kycUpload.fields([
    { name: "idDocument", maxCount: 1 },
    { name: "selfiePhoto", maxCount: 1 },
  ]),
  submitKYC
);

// ─── Availability ───
router.put("/availability", toggleAvailability);

// ─── Requests / Jobs ───
router.get("/requests", getIncomingRequests);
router.post("/requests/:id/accept", acceptJob);
router.post("/requests/:id/decline", declineJob);

// ─── Chat ───
router.get("/jobs/:id/chat", getJobChatMessages);
router.post("/jobs/:id/chat", sendJobChatMessage);

// ─── Active Job ───
router.post("/jobs/:id/en-route", markEnRoute);
router.post("/jobs/:id/complete", markComplete);

// ─── History & Earnings ───
router.get("/jobs", getJobs);
router.get("/jobs/:id", getJobById);      // ✅ NEW: Get single job by ID
router.get("/earnings", getEarnings);

export default router;