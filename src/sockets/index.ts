import { Server as HttpServer } from "http";
import { Server, Socket }       from "socket.io";
import { env }                  from "../config/env";
import { verifyAccessToken }    from "../utils/jwt.utils";

interface CustomSocket extends Socket {
  userId?: string;
  userRole?: string;
  roomId?: string;
}

export const setupWebSocket = (server: HttpServer) => {
  const io = new Server(server, {
    cors: {
      origin: env.CLIENT_URL || "http://localhost:3000",
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ─── Authentication Middleware ───
  io.use((socket: CustomSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = verifyAccessToken(token) as { userId: string; role: string };
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      console.log(`✅ Authenticated user ${decoded.userId} (${decoded.role})`);
      next();
    } catch (error) {
      console.error("WebSocket auth error:", error);
      next(new Error("Invalid token"));
    }
  });

  // ─── Connection ───
  io.on("connection", (socket: CustomSocket) => {
    console.log(`🔌 User connected: ${socket.id} (userId: ${socket.userId})`);

    // ─── TRACKING: Join Room ───
    socket.on("tracking:join", ({ pickupId, role }: { pickupId: string; role: string }) => {
      const roomId = `pickup:${pickupId}`;
      if (socket.roomId) {
        socket.leave(socket.roomId);
        console.log(`📦 User ${socket.userId} left room: ${socket.roomId}`);
      }
      socket.join(roomId);
      socket.roomId = roomId;
      console.log(`📦 User ${socket.userId} (${role}) joined room: ${roomId}`);
      io.to(roomId).emit("tracking:user-joined", {
        userId: socket.userId,
        role: role,
        timestamp: new Date().toISOString(),
      });
    });

    // ─── TRACKING: Collector Sends Location Update ───
    socket.on("tracking:update", (data: { pickupId: string; lat: number; lng: number }) => {
      const roomId = `pickup:${data.pickupId}`;
      socket.to(roomId).emit("tracking:location", {
        lat: data.lat,
        lng: data.lng,
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      });
      console.log(`📍 Location update from ${socket.userId} for pickup ${data.pickupId}: ${data.lat}, ${data.lng}`);
    });

    // ─── TRACKING: Status Update ───
    socket.on("tracking:status", (data: { pickupId: string; status: string; eta?: string }) => {
      const roomId = `pickup:${data.pickupId}`;
      io.to(roomId).emit("tracking:status", {
        status: data.status,
        eta: data.eta || "Calculating...",
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      });
      console.log(`🔄 Status update from ${socket.userId} for pickup ${data.pickupId}: ${data.status}`);
    });

    // ─── CHAT: Join Room ───
    socket.on("chat:join", ({ pickupId }: { pickupId: string }) => {
      const room = `pickup:${pickupId}`;
      socket.join(room);
      console.log(`📨 User ${socket.userId} joined chat room ${room}`);
    });

    // ─── CHAT: Leave Room ───
    socket.on("chat:leave", ({ pickupId }: { pickupId: string }) => {
      const room = `pickup:${pickupId}`;
      socket.leave(room);
      console.log(`📨 User ${socket.userId} left chat room ${room}`);
    });

    // ─── CHAT: Send Message ───
    socket.on("chat:message", (data: {
      pickupId: string;
      content: string;
      senderId: string;
      receiverId: string;
      messageId: string;
    }) => {
      const room = `pickup:${data.pickupId}`;
      io.to(room).emit("chat:message", {
        _id: data.messageId,
        content: data.content,
        senderId: data.senderId,
        receiverId: data.receiverId,
        createdAt: new Date().toISOString(),
      });
      console.log(`💬 Chat message in room ${room} from ${data.senderId}`);
    });

    // ─── CHAT: Mark as Read (optional) ───
    socket.on("chat:read", ({ messageId, userId }: { messageId: string; userId: string }) => {
      console.log(`👀 Message ${messageId} read by ${userId}`);
    });

    // ─── Leave Room (general) ───
    socket.on("leave:room", (roomId: string) => {
      socket.leave(roomId);
      socket.roomId = undefined;
      console.log(`📦 User ${socket.userId} left room: ${roomId}`);
    });

    // ─── Disconnect ───
    socket.on("disconnect", () => {
      if (socket.roomId) {
        console.log(`📦 User ${socket.userId} left room: ${socket.roomId} (disconnected)`);
        io.to(socket.roomId).emit("tracking:user-left", {
          userId: socket.userId,
          timestamp: new Date().toISOString(),
        });
      }
      console.log(`🔌 User disconnected: ${socket.id}`);
    });

    // ─── Error Handler ───
    socket.on("error", (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  return io;
};