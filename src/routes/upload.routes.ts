import { Router }         from "express";
import multer             from "multer";
import { uploadFile }     from "../controllers/upload.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

// All upload routes require authentication
router.use(authMiddleware);
router.post("/", upload.single("photo"), uploadFile);

export default router;