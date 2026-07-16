import express              from "express";
import cors                 from "cors";
import helmet               from "helmet";
import morgan               from "morgan";
import http                 from "http";
import { env, validateEnv } from "./config/env";
import { connectDB }        from "./config/db";
import authRoutes           from "./routes/auth.routes";
import residentRoutes       from "./routes/resident.routes";
import collectorRoutes      from "./routes/collector.routes";
import adminRoutes          from "./routes/admin.routes";
import paymentRoutes        from "./routes/payment.routes";
import { errorHandler }     from "./middleware/error.middleware";
import { setupWebSocket }   from "./sockets";

const app = express();
const server = http.createServer(app);

// ─── Validate Environment Variables ───
validateEnv();

// ─── CORS Configuration ───
// Build the allowed origins list
const allowedOrigins = [
  "http://localhost:3000",
  "https://wastemap-frontend-git-main-eyongrene211s-projects.vercel.app", // your current Vercel URL
  env.CLIENT_URL, // any custom URL you set
].filter(Boolean); // remove empty values

// Remove duplicates (in case CLIENT_URL matches one of the above)
const uniqueAllowedOrigins = [...new Set(allowedOrigins)];

console.log("✅ Allowed CORS origins:", uniqueAllowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      // In development, allow all origins for easier testing
      if (process.env.NODE_ENV === "development") {
        return callback(null, true);
      }

      // In production, check against the allowed list
      if (uniqueAllowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`❌ CORS blocked: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Other Middleware ───
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

// ─── Routes ───
app.use("/api/auth", authRoutes);
app.use("/api/resident", residentRoutes);
app.use("/api/collector", collectorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "WasteMap API running",
    timestamp: new Date().toISOString(),
  });
});

// ─── Error Handler (must be last) ───
app.use(errorHandler);

// ─── Connect to MongoDB ───
connectDB();

// ─── Setup WebSocket ───
const io = setupWebSocket(server);
app.set("io", io);

// ─── Start Server ───
server.listen(env.PORT, () => {
  let paymentMode = "MOCK (testing)";
  if (env.FAPSHI_COLLECTION_API_KEY) {
    paymentMode = "Fapshi (live ready)";
  } else if (env.PAYUNIT_API_KEY) {
    paymentMode = "PayUnit (legacy)";
  }

  console.log(`🚀 Server running on port ${env.PORT}`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
  console.log(`🔌 WebSocket enabled: ws://localhost:${env.PORT}`);
  console.log(`💳 Payment mode: ${paymentMode}`);
  console.log(`🌐 CORS allowed origins:`, uniqueAllowedOrigins);
});