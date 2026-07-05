import axios   from "axios";
import { env } from "../config/env";

export const sendSMS = async (phone: string, message: string): Promise<boolean> => {
  try {
    // Remove any leading + or 237 if present
    const cleanPhone = phone.replace(/^\+237/, "").trim();

    const response = await axios.post(
      "https://api.africastalking.com/version1/messaging",
      new URLSearchParams({
        username: env.AFRICASTALKING_USERNAME,
        to: `+237${cleanPhone}`,
        message: message,
        from: env.AFRICASTALKING_SENDER,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          apiKey: env.AFRICASTALKING_API_KEY,
        },
      }
    );

    return response.status === 201 || response.data?.status === "success";
  } catch (error) {
    console.error("SMS sending failed:", error);
    return false;
  }
};

export const sendOTP = async (phone: string, otp: string): Promise<boolean> => {
  const message = `Your WasteMap CM verification code is: ${otp}. Valid for 10 minutes.`;

  // In development, just log it
  if (env.NODE_ENV === "development") {
    console.log(`📱 OTP for ${phone}: ${otp}`);
    console.log(`📝 Message: ${message}`);
    return true;
  }

  // In production, send via Africa'sTalking
  return await sendSMS(phone, message);
};