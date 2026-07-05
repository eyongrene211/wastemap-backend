import { Router }         from "express";
import {
  requestOTP,
  verifyOTPAndRegister,
  loginWithOTP,
  login,
  refreshToken,
  logout,
  getMe,
} from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { roleMiddleware } from "../middleware/role.middleware";

const router = Router();

// ─── Public Routes ───
router.post("/request-otp", requestOTP);
router.post("/verify-otp", verifyOTPAndRegister);
router.post("/login-otp", loginWithOTP);
router.post("/login", login);
router.post("/refresh", refreshToken);

// ─── Protected Routes ───
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, getMe);

// ─── Role-Protected Routes (Example) ───
// router.get("/admin-only", authMiddleware, roleMiddleware(["admin"]), (req, res) => {
//   res.json({ message: "Admin only" });
// });

export default router;