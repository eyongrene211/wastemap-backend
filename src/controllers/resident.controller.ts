import { Request, Response } from "express";
import mongoose              from "mongoose";
import { User }              from "../models/User.model";
import { CollectorProfile }  from "../models/CollectorProfile.model";
import { PickupRequest }     from "../models/PickupRequest.model";
import { Payment }           from "../models/Payment.model";
import { Message }           from "../models/Message.model";
import { AuthRequest }       from "../middleware/auth.middleware";

// ──────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────
export const getDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const allPickups = await PickupRequest.find({ residentId: userId });
    const totalPickups = allPickups.length;

    const activeRequests = allPickups.filter(
      (p) => p.status === "pending" || p.status === "assigned" || p.status === "en_route"
    ).length;

    const escrowAmount = allPickups
      .filter((p) => p.paymentStatus === "held")
      .reduce((sum, p) => sum + p.priceAgreed, 0);

    const recentPickups = await PickupRequest.find({ residentId: userId })
      .sort({ createdAt: -1 })
      .limit(3)
      .populate("collectorId", "name phone");

    const formattedRecentPickups = recentPickups.map((p) => ({
      id: p._id.toString(),
      date: p.createdAt.toISOString(),
      neighbourhood: p.neighbourhood,
      status: p.status,
      amount: p.priceAgreed,
      wasteType: p.wasteTypes[0] || "Household",
    }));

    const activePickupData = await PickupRequest.findOne({
      residentId: userId,
      status: { $in: ["pending", "assigned", "en_route"] },
    }).populate("collectorId", "name phone");

    let activePickup = null;
    if (activePickupData) {
      const collector = activePickupData.collectorId as any;
      activePickup = {
        id: activePickupData._id.toString(),
        neighbourhood: activePickupData.neighbourhood,
        address: activePickupData.addressDescription,
        collectorName: collector?.name || "Collector assigned soon",
        collectorPhone: collector?.phone || "",
        status: activePickupData.status,
        eta: activePickupData.status === "en_route" ? "~15 min" : "Waiting for collector",
        wasteType: activePickupData.wasteTypes[0] || "Household",
      };
    }

    return res.status(200).json({
      totalPickups,
      activeRequests,
      escrowAmount,
      recentPickups: formattedRecentPickups,
      activePickup,
    });
  } catch (error) {
    console.error("Get dashboard error:", error);
    return res.status(500).json({ message: "Failed to load dashboard data" });
  }
};

// ──────────────────────────────────────────────
// CREATE PICKUP REQUEST
// ──────────────────────────────────────────────
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
      collectorId,
      location,
    } = req.body;

    if (!addressDescription || !neighbourhood || !city || !wasteTypes || !priceAgreed) {
      return res.status(400).json({
        message: "Missing required fields: addressDescription, neighbourhood, city, wasteTypes, priceAgreed",
      });
    }

    const pickupLocation = location || {
      type: "Point" as const,
      coordinates: [9.7036, 4.0511],
    };

    const pickupRequest = new PickupRequest({
      residentId: userId,
      location: pickupLocation,
      addressDescription,
      neighbourhood,
      city,
      wasteTypes,
      notes: notes || "",
      photoUrl: photoUrl || "",
      type: type || "direct",
      scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
      scheduledTimeSlot: scheduledTimeSlot || undefined,
      priceAgreed,
      status: "pending",
      paymentStatus: "pending",
    });

    if (collectorId && type === "direct") {
      pickupRequest.collectorId = collectorId;
    }

    await pickupRequest.save();

    return res.status(201).json({
      message: "Pickup request created successfully",
      pickupRequest,
    });
  } catch (error) {
    console.error("Create pickup request error:", error);
    return res.status(500).json({ message: "Failed to create pickup request" });
  }
};

// ──────────────────────────────────────────────
// GET ALL PICKUPS
// ──────────────────────────────────────────────
export const getPickups = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { status, limit = 10, page = 1, search } = req.query;

    const filter: any = { residentId: userId };
    if (status && status !== "all") {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { neighbourhood: { $regex: search, $options: "i" } },
        { addressDescription: { $regex: search, $options: "i" } },
      ];
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

// ──────────────────────────────────────────────
// GET SINGLE PICKUP DETAIL
// ──────────────────────────────────────────────
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

    const resident = pickup.residentId as any;
    const collector = pickup.collectorId as any;

    if (
      resident._id.toString() !== userId &&
      collector?._id?.toString() !== userId
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const payment = await Payment.findOne({ pickupRequestId: id });

    return res.status(200).json({
      pickup,
      payment: payment || null,
    });
  } catch (error) {
    console.error("Get pickup detail error:", error);
    return res.status(500).json({ message: "Failed to get pickup detail" });
  }
};

// ──────────────────────────────────────────────
// CONFIRM PICKUP COMPLETION
// ──────────────────────────────────────────────
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

    if (pickup.residentId.toString() !== userId) {
      return res.status(403).json({ message: "Only the resident can confirm pickup" });
    }

    if (pickup.status !== "completed") {
      return res.status(400).json({ message: "Pickup must be marked as completed by collector first" });
    }

    pickup.paymentStatus = "released";
    await pickup.save();

    const payment = await Payment.findOne({ pickupRequestId: id });
    if (payment) {
      payment.status = "released";
      payment.releasedAt = new Date();
      await payment.save();
    }

    return res.status(200).json({
      message: "Pickup confirmed and payment released",
      pickup,
    });
  } catch (error) {
    console.error("Confirm pickup error:", error);
    return res.status(500).json({ message: "Failed to confirm pickup" });
  }
};

// ──────────────────────────────────────────────
// CANCEL PICKUP REQUEST
// ──────────────────────────────────────────────
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

    if (pickup.residentId.toString() !== userId) {
      return res.status(403).json({ message: "Only the resident can cancel the pickup" });
    }

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

// ──────────────────────────────────────────────
// GET PROFILE
// ──────────────────────────────────────────────
export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const totalPickups = await PickupRequest.countDocuments({ residentId: userId });
    const completedPickups = await PickupRequest.countDocuments({
      residentId: userId,
      status: "completed",
    });
    const pendingPickups = await PickupRequest.countDocuments({
      residentId: userId,
      status: { $in: ["pending", "assigned", "en_route"] },
    });

    return res.status(200).json({
      id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email || "",
      city: user.city || "",
      neighbourhood: user.neighbourhood || "",
      language: user.language || "en",
      totalPickups,
      completedPickups,
      pendingPickups,
      avatar: user.avatar || "",
      notificationPrefs: user.notificationPrefs || {
        sms: true,
        push: true,
        reminders: true,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({ message: "Failed to get profile" });
  }
};

// ──────────────────────────────────────────────
// UPDATE PROFILE
// ──────────────────────────────────────────────
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { name, city, neighbourhood, language, notificationPrefs } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name) user.name = name;
    if (city) user.city = city;
    if (neighbourhood !== undefined) user.neighbourhood = neighbourhood;
    if (language) user.language = language;
    if (notificationPrefs) {
      user.notificationPrefs = {
        sms: notificationPrefs.sms ?? user.notificationPrefs?.sms ?? true,
        push: notificationPrefs.push ?? user.notificationPrefs?.push ?? true,
        reminders: notificationPrefs.reminders ?? user.notificationPrefs?.reminders ?? true,
      };
    }

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        city: user.city,
        neighbourhood: user.neighbourhood,
        language: user.language,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ message: "Failed to update profile" });
  }
};

// ──────────────────────────────────────────────
// GET PAYMENTS
// ──────────────────────────────────────────────
export const getPayments = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const payments = await Payment.find({ residentId: userId })
      .populate("pickupRequestId", "neighbourhood addressDescription status")
      .sort({ createdAt: -1 });

    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    const inEscrow = payments
      .filter((p) => p.status === "held")
      .reduce((sum, p) => sum + p.amount, 0);
    const pending = payments
      .filter((p) => p.status === "pending")
      .reduce((sum, p) => sum + p.amount, 0);

    const history = payments.map((p) => {
      const pickup = p.pickupRequestId as any;
      return {
        id: p._id.toString(),
        date: p.createdAt.toISOString(),
        amount: p.amount,
        type: "pickup",
        status: p.status,
        description: pickup?.neighbourhood || "Pickup payment",
      };
    });

    return res.status(200).json({
      total,
      inEscrow,
      pending,
      history,
    });
  } catch (error) {
    console.error("Get payments error:", error);
    return res.status(500).json({ message: "Failed to get payments" });
  }
};

// ──────────────────────────────────────────────
// GET AVAILABLE COLLECTORS (for residents)
// ──────────────────────────────────────────────
export const getAvailableCollectors = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { lat, lng, radius = 10, limit = 20 } = req.query;

    const query: any = {
      kycStatus: "approved",
      availability: "online",
    };

    // If location provided, try to find collectors with currentLocation
    if (lat && lng) {
      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);

      // Get collectors with currentLocation and filter by distance in memory
      query.currentLocation = {
        $exists: true,
        $ne: null,
      };
    }

    const collectors = await CollectorProfile.find(query)
      .populate("userId", "name phone avatar")
      .limit(Number(limit))
      .lean();

    const formattedCollectors = collectors.map((profile) => {
      const user = profile.userId as any;
      return {
        id: profile._id.toString(),
        userId: user?._id?.toString() || "",
        name: user?.name || "Collector",
        phone: user?.phone || "",
        avatar: user?.avatar || "",
        rating: profile.rating || 0,
        reviews: profile.totalRatings || 0,
        vehicle: profile.vehicleType || "Tricycle",
        distance: "1.2 km", // Calculate if location provided
        priceRangeMin: profile.priceRangeMin || 500,
        priceRangeMax: profile.priceRangeMax || 2000,
        acceptedWasteTypes: profile.acceptedWasteTypes || [],
        activeJobs: profile.activeJobs || 0,
        capacityLimit: profile.capacityLimit || 2,
        availability: profile.availability,
      };
    });

    return res.status(200).json({
      collectors: formattedCollectors,
      count: formattedCollectors.length,
    });
  } catch (error) {
    console.error("Get available collectors error:", error);
    return res.status(500).json({
      message: "Failed to get available collectors",
    });
  }
};

// ──────────────────────────────────────────────
// GET CHAT MESSAGES
// ──────────────────────────────────────────────
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

// ──────────────────────────────────────────────
// SEND CHAT MESSAGE
// ──────────────────────────────────────────────
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

    if (
      pickup.residentId.toString() !== userId &&
      pickup.collectorId?.toString() !== userId
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

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

    return res.status(201).json({
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    console.error("Send chat message error:", error);
    return res.status(500).json({ message: "Failed to send message" });
  }
};