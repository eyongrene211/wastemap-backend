import crypto from "crypto";

// Store OTPs in memory (use Redis in production)
interface OTPRecord {
  otp: string;
  expiresAt: Date;
  attempts: number;
}

const otpStore = new Map<string, OTPRecord>();

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const storeOTP = (phone: string, otp: string) => {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);
  otpStore.set(phone, { otp, expiresAt, attempts: 0 });
};

export const verifyOTP = (phone: string, otp: string): boolean => {
  const record = otpStore.get(phone);
  if (!record) return false;

  // Check expiry
  if (new Date() > record.expiresAt) {
    otpStore.delete(phone);
    return false;
  }

  // Check attempts (max 3)
  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(phone);
    return false;
  }

  // Verify
  if (record.otp !== otp) {
    record.attempts += 1;
    otpStore.set(phone, record);
    return false;
  }

  // Success — delete OTP
  otpStore.delete(phone);
  return true;
};

export const getOTPRecord = (phone: string): OTPRecord | undefined => {
  return otpStore.get(phone);
};

export const clearOTP = (phone: string) => {
  otpStore.delete(phone);
};