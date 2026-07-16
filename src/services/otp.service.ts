// src/services/otp.service.ts
import crypto from "crypto";

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

export const storeOTP = (identifier: string, otp: string) => {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);
  otpStore.set(identifier, { otp, expiresAt, attempts: 0 });
};

export const verifyOTP = (identifier: string, otp: string): boolean => {
  const record = otpStore.get(identifier);
  if (!record) return false;

  if (new Date() > record.expiresAt) {
    otpStore.delete(identifier);
    return false;
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(identifier);
    return false;
  }

  if (record.otp !== otp) {
    record.attempts += 1;
    otpStore.set(identifier, record);
    return false;
  }

  otpStore.delete(identifier);
  return true;
};

export const getOTPRecord = (identifier: string): OTPRecord | undefined => {
  return otpStore.get(identifier);
};

export const clearOTP = (identifier: string) => {
  otpStore.delete(identifier);
};