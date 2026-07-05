import express              from "express";
import cors                 from "cors";
import helmet               from "helmet";
import morgan               from "morgan";
import http                 from "http";
import { env, validateEnv } from "./config/env";
import { connectDB }        from "./config/db";
import authRoutes           from "./routes/auth.routes";
import { errorHandler }     from "./middleware/error.middleware";

const app = express();
const server = http.createServer(app);

// ─── Validate Environment Variables ───
validateEnv();

// ─── Middleware ───
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

// ─── Routes ───
app.use("/api/auth", authRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "WasteMap API running" });
});

// ─── Error Handler (must be last) ───
app.use(errorHandler);

// ─── Connect to MongoDB ───
connectDB();

// ─── Start Server ───
server.listen(env.PORT, () => {
  console.log(`🚀 Server running on port ${env.PORT}`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
});