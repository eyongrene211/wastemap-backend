import { Request, Response }                from "express";
import bcrypt                               from "bcryptjs";
import { User }                             from "../models/User.model";
import { CollectorProfile }                 from "../models/CollectorProfile.model";
import { generateOTP, storeOTP, verifyOTP } from "../services/otp.service";
import { sendOTP }                          from "../services/sms.service";
import { generateTokens }                   from "../utils/jwt.utils";
import { verifyRefreshToken }               from "../utils/jwt.utils";

// ─── Request OTP ───
export const requestOTP = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone || phone.length < 8) {
      return res.status(400).json({ message: "Valid phone number required" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ phone });
    if (existingUser && existingUser.isSuspended) {
      return res.status(403).json({ message: "Account suspended" });
    }

    // Generate and store OTP
    const otp = generateOTP();
    storeOTP(phone, otp);

    // Send OTP via SMS
    await sendOTP(phone, otp);

    return res.status(200).json({
      message: "OTP sent successfully",
      phone: phone,
      // In development, return OTP for testing
      ...(process.env.NODE_ENV === "development" && { otp }),
    });
  } catch (error) {
    console.error("Request OTP error:", error);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
};

// ─── Verify OTP + Register OR Login ───
export const verifyOTPAndRegister = async (req: Request, res: Response) => {
  try {
    const { phone, otp, name, role, city, neighbourhood, language, password } = req.body;

    // 1. Verify OTP
    if (!verifyOTP(phone, otp)) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // 2. Check if user already exists
    let user = await User.findOne({ phone });

    if (user) {
      // ─── USER EXISTS — LOGIN ───
      if (user.isSuspended) {
        return res.status(403).json({ message: "Account suspended" });
      }

      const tokens = generateTokens(user._id.toString(), user.role);
      return res.status(200).json({
        message: "Login successful",
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          isVerified: user.isVerified,
        },
        tokens,
      });
    }

    // 3. ─── NEW USER — REGISTER ───
    if (!name || !role) {
      return res.status(400).json({
        message: "Name and role are required for new users",
      });
    }

    // Hash password if provided (optional)
    let passwordHash: string | undefined;
    if (password && password.length >= 6) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Create user
    user = new User({
      phone,
      name,
      role,
      city,
      neighbourhood,
      language: language || "en",
      isVerified: true,
      passwordHash,
    });

    await user.save();

    // If collector, create collector profile
    if (role === "collector") {
      const collectorProfile = new CollectorProfile({
        userId: user._id,
        vehicleType: "tricycle",
        priceRangeMin: 500,
        priceRangeMax: 2000,
        kycStatus: "pending",
        availability: "offline",
      });
      await collectorProfile.save();
    }

    const tokens = generateTokens(user._id.toString(), user.role);

    return res.status(201).json({
      message: "Registration successful",
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
      },
      tokens,
    });
  } catch (error: any) {
    console.error("Verify OTP error:", error);

    // Handle duplicate key error (phone already exists)
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Phone number already registered. Please login.",
      });
    }

    return res.status(500).json({ message: "Registration failed" });
  }
};

// ─── Login with OTP (Explicit) ───
export const loginWithOTP = async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: "Phone and OTP required" });
    }

    // Verify OTP
    if (!verifyOTP(phone, otp)) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Find user
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        message: "User not found. Please register first.",
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({ message: "Account suspended" });
    }

    const tokens = generateTokens(user._id.toString(), user.role);

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
      },
      tokens,
    });
  } catch (error) {
    console.error("Login with OTP error:", error);
    return res.status(500).json({ message: "Login failed" });
  }
};

// ─── Login with Password (v2) ───
export const login = async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: "Phone and password required" });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.passwordHash) {
      return res.status(401).json({
        message: "Account created with OTP. Please use OTP login.",
      });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.isSuspended) {
      return res.status(403).json({ message: "Account suspended" });
    }

    const tokens = generateTokens(user._id.toString(), user.role);

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
      },
      tokens,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login failed" });
  }
};

// ─── Refresh Token ───
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token required" });
    }

    const decoded = verifyRefreshToken(refreshToken) as { userId: string; role: string };
    if (!decoded) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.isSuspended) {
      return res.status(401).json({ message: "User not found or suspended" });
    }

    const tokens = generateTokens(user._id.toString(), user.role);

    return res.status(200).json(tokens);
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(401).json({ message: "Invalid refresh token" });
  }
};

// ─── Logout ───
export const logout = async (req: Request, res: Response) => {
  return res.status(200).json({ message: "Logged out successfully" });
};

// ─── Get Current User Profile ───
export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let collectorProfile = null;
    if (user.role === "collector") {
      collectorProfile = await CollectorProfile.findOne({ userId: user._id });
    }

    return res.status(200).json({
      user,
      collectorProfile,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({ message: "Failed to get profile" });
  }
};