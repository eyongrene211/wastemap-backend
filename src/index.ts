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
import paymentRoutes        from "./routes/payment.routes"; // ✅ Payment routes re-added
import { errorHandler }     from "./middleware/error.middleware";
import { setupWebSocket }   from "./sockets";

const app = express();
const server = http.createServer(app);

// ─── Validate Environment Variables ───
validateEnv();

// ─── Middleware ───
app.use(helmet());

const allowedOrigins = [
  "http://localhost:3000",
  env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

// ─── Routes ───
app.use("/api/auth", authRoutes);
app.use("/api/resident", residentRoutes);
app.use("/api/collector", collectorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes); // ✅ Payment routes re-added

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
  // Determine payment mode
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
});