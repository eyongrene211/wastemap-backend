import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGODB_URI: process.env.MONGODB_URI || "",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "",
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || "15m",
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || "7d",
  AFRICASTALKING_API_KEY: process.env.AFRICASTALKING_API_KEY || "",
  AFRICASTALKING_USERNAME: process.env.AFRICASTALKING_USERNAME || "",
  AFRICASTALKING_SENDER: process.env.AFRICASTALKING_SENDER || "WASTEMAP",
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
  PAYUNIT_API_KEY: process.env.PAYUNIT_API_KEY || "",
  PAYUNIT_API_URL: process.env.PAYUNIT_API_URL || "https://api.payunit.net/v1",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",
};

export const validateEnv = () => {
  const required = [
    "MONGODB_URI",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
  ];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
};