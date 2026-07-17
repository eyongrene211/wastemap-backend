import nodemailer from 'nodemailer';
import { env }    from '../config/env';

// ─── Create Transporter ───
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.APP_EMAIL,
    pass: env.GOOGLE_APP_PASSWORD,
  },
});

// ─── Verify Transporter ───
export async function verifyTransporter(): Promise<void> {
  try {
    await transporter.verify();
    console.log('✅ Email transporter is ready (Gmail)');
  } catch (error) {
    console.error('❌ Email transporter verification failed. Please check APP_EMAIL and GOOGLE_APP_PASSWORD.');
    console.error(error);
  }
}

// ─── Generic Email Sender ───
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const info = await transporter.sendMail({
      from: `"WasteMap CM" <${env.APP_EMAIL}>`,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return false;
  }
}

// ─── Send OTP Email (Always sends in production AND development) ───
export async function sendOTPEmail(to: string, otp: string): Promise<boolean> {
  const subject = 'Your WasteMap CM Verification Code';

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

  // Always log OTP (for debugging)
  console.log(`📧 OTP for ${to}: ${otp}`);

  // Always attempt to send real email (in all environments)
  const sent = await sendEmail(to, subject, html);

  // If send fails, we still have the OTP logged (fallback)
  if (!sent) {
    console.error(`❌ Email delivery failed for ${to}. OTP available in logs.`);
  }

  return sent;
}