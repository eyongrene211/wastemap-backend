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

  // ─── Email (Brevo HTTPS API — replaces SMTP/Gmail, which Render's free
  // tier blocks outbound as of Sept 2025) ───
  BREVO_API_KEY: process.env.BREVO_API_KEY || "",
  BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL || "",

  // ─── Email (Nodemailer with Gmail — kept for local dev / rollback only.
  // Do NOT rely on this in production on Render's free tier: SMTP ports
  // 25/465/587 are blocked outbound, so this will always time out there. ───
  APP_EMAIL: process.env.APP_EMAIL || "",
  GOOGLE_APP_PASSWORD: process.env.GOOGLE_APP_PASSWORD || "",

  // ─── Resend (Legacy — kept for reference; requires a verified domain to
  // send to arbitrary recipients, which Brevo doesn't) ───
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",

  // ─── Africa's Talking (legacy — kept for later phone SMS re-integration) ───
  AFRICASTALKING_API_KEY: process.env.AFRICASTALKING_API_KEY || "",
  AFRICASTALKING_USERNAME: process.env.AFRICASTALKING_USERNAME || "",
  AFRICASTALKING_SENDER: process.env.AFRICASTALKING_SENDER || "WASTEMAP",

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
  ];

  const missingRequired = required.filter((key) => !process.env[key]);

  if (missingRequired.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingRequired.join(", ")}`
    );
  }

  // ─── Optional: Warn about missing email credentials ───
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    console.warn(
      "⚠️  Brevo email credentials missing (BREVO_API_KEY / BREVO_SENDER_EMAIL). OTP emails will not work until set."
    );
  }

  // ─── Optional: Warn about missing payment credentials ───
  if (process.env.NODE_ENV === "production") {
    if (!process.env.PAYUNIT_API_KEY && !process.env.FAPSHI_COLLECTION_API_KEY) {
      console.warn(
        "⚠️  No payment API keys set (PayUnit or Fapshi). Payment features will use mock mode."
      );
    }
  }
};