import { Request, Response, NextFunction } from "express";
import { verifyAccessToken }               from "../utils/jwt.utils";
import { User }                            from "../models/User.model";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token) as { userId: string; role: string };

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // Check if user still exists and is not suspended
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    if (user.isSuspended) {
      return res.status(403).json({ message: "Account suspended" });
    }

    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};