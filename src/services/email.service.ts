import axios   from "axios";
import { env } from "../config/env";

// ─── Brevo (HTTPS API) ───
// Switched from Nodemailer/Gmail SMTP because Render's free tier blocks all
// outbound SMTP traffic (ports 25, 465, 587) as of Sept 2025 — this is a
// platform-level firewall rule, not something fixable via credentials or
// port/TLS settings. Brevo sends over plain HTTPS (port 443), which is never
// blocked. Unlike Resend, Brevo lets a single verified sender address send
// to ANY recipient on the free tier — no full domain/DNS verification
// required, which matters here since real users register with arbitrary
// email addresses, not just the developer's own inbox.
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// ─── Verify Config on Startup ───
// Brevo is a stateless HTTPS API, not a persistent connection like SMTP —
// there's nothing to "connect" to ahead of time, so this just confirms the
// required config is present rather than opening a socket.
export async function verifyTransporter(): Promise<void> {
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) {
    console.warn(
      "⚠️  Brevo not configured (BREVO_API_KEY / BREVO_SENDER_EMAIL missing). OTP emails will not work until set."
    );
    return;
  }
  console.log("✅ Brevo email API configured (HTTPS — unaffected by SMTP port blocks)");
}

// ─── Generic Email Sender ───
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const response = await axios.post(
      BREVO_API_URL,
      {
        sender: { name: "WasteMap CM", email: env.BREVO_SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "api-key": env.BREVO_API_KEY,
        },
        timeout: 15000,
      }
    );

    console.log(`📧 Email sent to ${to}: ${response.data?.messageId}`);
    return true;
  } catch (error: any) {
    const details = error.response?.data || error.message;
    console.error("❌ Failed to send email:", details);
    return false;
  }
}

// ─── Send OTP Email ───
export async function sendOTPEmail(to: string, otp: string): Promise<boolean> {
  const subject = "Your WasteMap CM Verification Code";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7e4; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #00703C; font-size: 24px; margin: 0;">♻️ WasteMap CM</h1>
        <p style="color: #666; font-size: 14px; margin: 4px 0 0;">Cameroon's Waste. Collected on Demand.</p>
      </div>
      <div style="text-align: center; padding: 24px 0; border-top: 1px solid #e5e7e4; border-bottom: 1px solid #e5e7e4;">
        <p style="color: #333; font-size: 16px; margin: 0 0 16px;">Your verification code is:</p>
        <p style="font-size: 42px; font-weight: bold; letter-spacing: 8px; color: #00703C; margin: 0;">${otp}</p>
        <p style="color: #666; font-size: 14px; margin: 16px 0 0;">This code expires in <strong>10 minutes</strong>.</p>
      </div>
      <div style="padding: 16px 0; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">If you didn't request this code, you can safely ignore this email.</p>
        <p style="color: #999; font-size: 12px; margin: 8px 0 0;">© 2026 WasteMap CM – Built in Cameroon.</p>
      </div>
    </div>
  `;

  // Only log the raw OTP locally, for dev debugging. This must never run
  // in production — it would put a live verification code straight into
  // the server logs.
  if (env.NODE_ENV === "development") {
    console.log(`📧 [DEV ONLY] OTP for ${to}: ${otp}`);
  }

  const sent = await sendEmail(to, subject, html);

  if (!sent) {
    console.error(`❌ OTP email delivery failed for ${to}.`);
  }

  return sent;
}