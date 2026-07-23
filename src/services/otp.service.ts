// src/services/otp.service.ts
import crypto from "crypto";

interface OTPRecord {
  otp: string;
  issuedAt: Date;
  expiresAt: Date;
  attempts: number;
}

const otpStore = new Map<string, OTPRecord>();

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;
// Minimum time that must pass before a NEW code can be issued for the same
// identifier. Without this, two close-together requests (a double-click,
// a back-button resubmit, testing in two tabs) silently overwrite the
// still-valid code with a new one and send a second email — so if someone
// reads the first email and types that code, it's already been replaced
// and "invalid OTP" is the guaranteed result, even though they did nothing
// wrong. This makes a rapid second request wait instead of silently
// invalidating the first.
const RESEND_COOLDOWN_SECONDS = 30;

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Returns null if a new OTP can be issued now, or the number of seconds
 * the caller must still wait if a recent one is still within its cooldown.
 */
export const getResendCooldownRemaining = (identifier: string): number | null => {
  const record = otpStore.get(identifier);
  if (!record) return null;

  const secondsSinceIssued = (Date.now() - record.issuedAt.getTime()) / 1000;
  const remaining = RESEND_COOLDOWN_SECONDS - secondsSinceIssued;
  return remaining > 0 ? Math.ceil(remaining) : null;
};

export const storeOTP = (identifier: string, otp: string) => {
  const now = new Date();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);
  otpStore.set(identifier, { otp, issuedAt: now, expiresAt, attempts: 0 });
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