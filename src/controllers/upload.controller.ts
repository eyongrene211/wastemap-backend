import { Request, Response } from "express";
import { v2 as cloudinary }  from "cloudinary";
import { env }               from "../config/env";
import { AuthRequest }       from "../middleware/auth.middleware";

// Configure Cloudinary
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export const uploadFile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "wastemap/pickups",
          resource_type: "image",
          max_bytes: 5 * 1024 * 1024, // 5MB limit
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file!.buffer);
    });

    return res.status(200).json({
      message: "File uploaded successfully",
      url: (result as any).secure_url,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ message: "Failed to upload file" });
  }
};