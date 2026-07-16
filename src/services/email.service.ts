import { Resend }  from "resend";
import { env }     from "../config/env";

const resend = new Resend(env.RESEND_API_KEY);

// Resend's free-tier test sender — works with zero domain verification.
// Swap to a verified custom domain address later if you set one up.
const FROM_ADDRESS = "WasteMap CM <onboarding@resend.dev>";

export const sendOTPEmail = async (email: string, otp: string): Promise<boolean> => {
  const subject = "Your WasteMap CM verification code";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #00703C;">WasteMap CM</h2>
      <p>Your verification code is:</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1a1a1a;">
        ${otp}
      </p>
      <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
      <p style="color: #999; font-size: 12px;">
        If you didn't request this code, you can safely ignore this email.
      </p>
    </div>
  `;

  // In development, just log it — avoids burning email quota during local testing
  if (env.NODE_ENV === "development") {
    console.log(`📧 OTP for ${email}: ${otp}`);
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject,
      html,
    });

    if (error) {
      console.error("Resend email error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Email sending failed:", error);
    return false;
  }
};