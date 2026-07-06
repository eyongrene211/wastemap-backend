import { Request, Response } from "express";
import { User }              from "../models/User.model";
import { CollectorProfile }  from "../models/CollectorProfile.model";
import { PickupRequest }     from "../models/PickupRequest.model";
import { Message }           from "../models/Message.model";
import { AuthRequest }       from "../middleware/auth.middleware";

// ─── Create Pickup Request ───
export const createPickupRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      addressDescription,
      neighbourhood,
      city,
      wasteTypes,
      notes,
      photoUrl,
      type,
      scheduledDate,
      scheduledTimeSlot,
      priceAgreed,
    } = req.body;

    // Validate required fields
    if (!addressDescription || !neighbourhood || !city || !wasteTypes || !priceAgreed) {
      return res.status(400).json({
        message: "Missing required fields: addressDescription, neighbourhood, city, wasteTypes, priceAgreed",
      });
    }

    // Get resident's location (in production, use geocoding or user input)
    const location = {
      type: "Point" as const,
      coordinates: [9.7036, 4.0511], // Default Douala coordinates — replace with actual geocoding
    };

    // Create pickup request
    const pickupRequest = new PickupRequest({
      residentId: userId,
      location,
      addressDescription,
      neighbourhood,
      city,
      wasteTypes,
      notes,
      photoUrl,
      type: type || "direct",
      scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
      scheduledTimeSlot,
      priceAgreed,
      status: "pending",
      paymentStatus: "pending",
    });

    await pickupRequest.save();

    // TODO: Find and assign nearest collector (matching logic later)

    return res.status(201).json({
      message: "Pickup request created successfully",
      pickupRequest,
    });
  } catch (error) {
    console.error("Create pickup request error:", error);
    return res.status(500).json({ message: "Failed to create pickup request" });
  }
};

// ─── Get All Pickups (with filters) ───
export const getPickups = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { status, limit = 10, page = 1 } = req.query;

    const filter: any = { residentId: userId };
    if (status) {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const pickups = await PickupRequest.find(filter)
      .populate("collectorId", "name phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await PickupRequest.countDocuments(filter);

    return res.status(200).json({
      pickups,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get pickups error:", error);
    return res.status(500).json({ message: "Failed to get pickups" });
  }
};

// ─── Get Single Pickup Detail ───
export const getPickupDetail = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const pickup = await PickupRequest.findById(id)
      .populate("residentId", "name phone")
      .populate("collectorId", "name phone");

    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    // Check if user owns this pickup or is the assigned collector
    if (
      pickup.residentId._id.toString() !== userId &&
      pickup.collectorId?._id.toString() !== userId
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    return res.status(200).json({ pickup });
  } catch (error) {
    console.error("Get pickup detail error:", error);
    return res.status(500).json({ message: "Failed to get pickup detail" });
  }
};

// ─── Confirm Pickup Completion ───
export const confirmPickup = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const pickup = await PickupRequest.findById(id);
    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    // Only resident can confirm
    if (pickup.residentId.toString() !== userId) {
      return res.status(403).json({ message: "Only the resident can confirm pickup" });
    }

    if (pickup.status !== "completed") {
      return res.status(400).json({ message: "Pickup must be marked as completed by collector first" });
    }

    // Update payment status — release escrow
    pickup.paymentStatus = "released";
    await pickup.save();

    // TODO: Trigger payout to collector via PayUnit

    return res.status(200).json({
      message: "Pickup confirmed and payment released",
      pickup,
    });
  } catch (error) {
    console.error("Confirm pickup error:", error);
    return res.status(500).json({ message: "Failed to confirm pickup" });
  }
};

// ─── Cancel Pickup Request ───
export const cancelPickup = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const { cancellationReason } = req.body;

    const pickup = await PickupRequest.findById(id);
    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    // Only resident can cancel
    if (pickup.residentId.toString() !== userId) {
      return res.status(403).json({ message: "Only the resident can cancel the pickup" });
    }

    // Cannot cancel if already completed
    if (pickup.status === "completed") {
      return res.status(400).json({ message: "Cannot cancel a completed pickup" });
    }

    pickup.status = "cancelled";
    pickup.cancelledAt = new Date();
    pickup.cancellationReason = cancellationReason || "Cancelled by user";
    await pickup.save();

    return res.status(200).json({
      message: "Pickup cancelled successfully",
      pickup,
    });
  } catch (error) {
    console.error("Cancel pickup error:", error);
    return res.status(500).json({ message: "Failed to cancel pickup" });
  }
};

// ─── Get Chat Messages ───
export const getChatMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const pickup = await PickupRequest.findById(id);
    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    // Check if user is part of this pickup
    if (
      pickup.residentId.toString() !== userId &&
      pickup.collectorId?.toString() !== userId
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const messages = await Message.find({ pickupRequestId: id })
      .populate("senderId", "name role")
      .sort({ createdAt: 1 });

    return res.status(200).json({ messages });
  } catch (error) {
    console.error("Get chat messages error:", error);
    return res.status(500).json({ message: "Failed to get messages" });
  }
};

// ─── Send Chat Message ───
export const sendChatMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: "Message content is required" });
    }

    const pickup = await PickupRequest.findById(id);
    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    // Check if user is part of this pickup
    if (
      pickup.residentId.toString() !== userId &&
      pickup.collectorId?.toString() !== userId
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Determine receiver
    const receiverId = pickup.residentId.toString() === userId
      ? pickup.collectorId
      : pickup.residentId;

    if (!receiverId) {
      return res.status(400).json({ message: "No collector assigned yet" });
    }

    const message = new Message({
      pickupRequestId: id,
      senderId: userId,
      receiverId: receiverId,
      content: content.trim(),
    });

    await message.save();

    // TODO: Emit via WebSocket for real-time delivery
    // io.to(`request:${id}`).emit('chat:message', message);

    return res.status(201).json({
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    console.error("Send chat message error:", error);
    return res.status(500).json({ message: "Failed to send message" });
  }
};