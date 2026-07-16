import dotenv from "dotenv";
dotenv.config();

export const env = {
  // ─── Server ───
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",

  // ─── MongoDB ───
  MONGODB_URI: process.env.MONGODB_URI || "",

  // ─── JWT ───
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "",
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || "15m",
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || "7d",

  // ─── Africa's Talking (legacy — kept for later phone SMS re-integration) ───
  AFRICASTALKING_API_KEY: process.env.AFRICASTALKING_API_KEY || "",
  AFRICASTALKING_USERNAME: process.env.AFRICASTALKING_USERNAME || "",
  AFRICASTALKING_SENDER: process.env.AFRICASTALKING_SENDER || "WASTEMAP",

  // ─── Resend (Email OTP) ───
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",

  // ─── Cloudinary ───
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",

  // ─── PayUnit (Legacy / Fallback) ───
  PAYUNIT_API_USER: process.env.PAYUNIT_API_USER || "",
  PAYUNIT_API_PASSWORD: process.env.PAYUNIT_API_PASSWORD || "",
  PAYUNIT_API_KEY: process.env.PAYUNIT_API_KEY || "",
  PAYUNIT_MODE: process.env.PAYUNIT_MODE || "test",
  PAYUNIT_RETURN_URL: process.env.PAYUNIT_RETURN_URL || "",
  PAYUNIT_NOTIFY_URL: process.env.PAYUNIT_NOTIFY_URL || "",
  PAYUNIT_DISBURSEMENT_NOTIFY_URL: process.env.PAYUNIT_DISBURSEMENT_NOTIFY_URL || "",

  // ─── Fapshi (for later — leave empty for mock) ───
  FAPSHI_BASE_URL: process.env.FAPSHI_BASE_URL || "",
  FAPSHI_COLLECTION_API_USER: process.env.FAPSHI_COLLECTION_API_USER || "",
  FAPSHI_COLLECTION_API_KEY: process.env.FAPSHI_COLLECTION_API_KEY || "",
  FAPSHI_PAYOUT_API_USER: process.env.FAPSHI_PAYOUT_API_USER || "",
  FAPSHI_PAYOUT_API_KEY: process.env.FAPSHI_PAYOUT_API_KEY || "",
  FAPSHI_WEBHOOK_SECRET: process.env.FAPSHI_WEBHOOK_SECRET || "",
  FAPSHI_WEBHOOK_URL: process.env.FAPSHI_WEBHOOK_URL || "",

  // ─── Client ───
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",
};

export const validateEnv = () => {
  const required = [
    "MONGODB_URI",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    // PayUnit, Fapshi, and Resend are optional for mock/dev mode
  ];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
};