import { Request, Response } from "express";
import mongoose              from "mongoose";
import { User }              from "../models/User.model";
import { CollectorProfile }  from "../models/CollectorProfile.model";
import { PickupRequest }     from "../models/PickupRequest.model";
import { Message }           from "../models/Message.model";
import { AuthRequest }       from "../middleware/auth.middleware";

// ─── Get Collector Profile ───
export const getCollectorProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const profile = await CollectorProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ message: "Collector profile not found" });
    }

    return res.status(200).json({
      user,
      profile,
    });
  } catch (error) {
    console.error("Get collector profile error:", error);
    return res.status(500).json({ message: "Failed to get profile" });
  }
};

// ─── Update Collector Profile ───
export const updateCollectorProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      vehicleType,
      acceptedWasteTypes,
      serviceArea,
      priceRangeMin,
      priceRangeMax,
      bio,
      capacityLimit,
    } = req.body;

    const profile = await CollectorProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ message: "Collector profile not found" });
    }

    if (vehicleType) profile.vehicleType = vehicleType;
    if (acceptedWasteTypes) profile.acceptedWasteTypes = acceptedWasteTypes;
    if (serviceArea) profile.serviceArea = serviceArea;
    if (priceRangeMin !== undefined) profile.priceRangeMin = priceRangeMin;
    if (priceRangeMax !== undefined) profile.priceRangeMax = priceRangeMax;
    if (bio !== undefined) profile.bio = bio;
    if (capacityLimit) profile.capacityLimit = capacityLimit;

    await profile.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      profile,
    });
  } catch (error) {
    console.error("Update collector profile error:", error);
    return res.status(500).json({ message: "Failed to update profile" });
  }
};

// ─── Toggle Availability ───
export const toggleAvailability = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { status } = req.body;

    if (!status || !["online", "offline"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'online' or 'offline'" });
    }

    const profile = await CollectorProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ message: "Collector profile not found" });
    }

    if (profile.kycStatus !== "approved") {
      return res.status(403).json({ message: "KYC not approved. Cannot go online." });
    }

    if (status === "online" && profile.activeJobs >= profile.capacityLimit) {
      return res.status(400).json({
        message: `At capacity (${profile.activeJobs}/${profile.capacityLimit} jobs). Complete a job first.`,
      });
    }

    profile.availability = status;
    await profile.save();

    return res.status(200).json({
      message: `Collector is now ${status}`,
      availability: profile.availability,
      activeJobs: profile.activeJobs,
      capacityLimit: profile.capacityLimit,
    });
  } catch (error) {
    console.error("Toggle availability error:", error);
    return res.status(500).json({ message: "Failed to toggle availability" });
  }
};

// ─── Get Incoming Requests ───
export const getIncomingRequests = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const profile = await CollectorProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ message: "Collector profile not found" });
    }

    if (profile.availability !== "online") {
      return res.status(400).json({ message: "You are offline. Go online to see requests." });
    }

    if (profile.kycStatus !== "approved") {
      return res.status(403).json({ message: "KYC not approved. Cannot accept requests." });
    }

    const requests = await PickupRequest.find({
      status: "pending",
    })
      .populate("residentId", "name phone")
      .sort({ createdAt: 1 })
      .limit(20);

    return res.status(200).json({
      requests,
      count: requests.length,
      activeJobs: profile.activeJobs,
      capacityLimit: profile.capacityLimit,
    });
  } catch (error) {
    console.error("Get incoming requests error:", error);
    return res.status(500).json({ message: "Failed to get requests" });
  }
};

// ─── Accept Job ───
export const acceptJob = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const profile = await CollectorProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ message: "Collector profile not found" });
    }

    if (profile.availability !== "online") {
      return res.status(400).json({ message: "You are offline. Go online to accept jobs." });
    }

    if (profile.kycStatus !== "approved") {
      return res.status(403).json({ message: "KYC not approved. Cannot accept jobs." });
    }

    if (profile.activeJobs >= profile.capacityLimit) {
      return res.status(400).json({
        message: `At capacity (${profile.activeJobs}/${profile.capacityLimit} jobs). Complete a job first.`,
      });
    }

    const pickup = await PickupRequest.findById(id);
    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    if (pickup.status !== "pending") {
      return res.status(400).json({ message: "This pickup is no longer available" });
    }

    pickup.collectorId = new mongoose.Types.ObjectId(userId);
    pickup.status = "assigned";
    await pickup.save();

    profile.activeJobs += 1;
    await profile.save();

    return res.status(200).json({
      message: "Job accepted successfully",
      pickup,
      activeJobs: profile.activeJobs,
      capacityLimit: profile.capacityLimit,
    });
  } catch (error) {
    console.error("Accept job error:", error);
    return res.status(500).json({ message: "Failed to accept job" });
  }
};

// ─── Decline Job ───
export const declineJob = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const { reason } = req.body;

    const pickup = await PickupRequest.findById(id);
    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    if (pickup.status !== "pending") {
      return res.status(400).json({ message: "This pickup is no longer available" });
    }

    console.log(`Collector ${userId} declined pickup ${id}. Reason: ${reason || "Not specified"}`);

    return res.status(200).json({
      message: "Job declined",
      pickupId: id,
      reason: reason || "Not specified",
    });
  } catch (error) {
    console.error("Decline job error:", error);
    return res.status(500).json({ message: "Failed to decline job" });
  }
};

// ─── Mark Job as En Route ───
export const markEnRoute = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const { lat, lng } = req.body;

    const pickup = await PickupRequest.findById(id);
    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    if (pickup.collectorId?.toString() !== userId) {
      return res.status(403).json({ message: "You are not assigned to this pickup" });
    }

    if (pickup.status !== "assigned") {
      return res.status(400).json({ message: "Pickup must be assigned before marking en route" });
    }

    pickup.status = "en_route";
    await pickup.save();

    if (lat && lng) {
      const profile = await CollectorProfile.findOne({ userId });
      if (profile) {
        profile.currentLocation = {
          lat,
          lng,
          updatedAt: new Date(),
        };
        await profile.save();
      }
    }

    return res.status(200).json({
      message: "Marked as en route",
      pickup,
    });
  } catch (error) {
    console.error("Mark en route error:", error);
    return res.status(500).json({ message: "Failed to mark en route" });
  }
};

// ─── Mark Job as Completed ───
export const markComplete = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const { afterPhoto, notes } = req.body;

    const pickup = await PickupRequest.findById(id);
    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    if (pickup.collectorId?.toString() !== userId) {
      return res.status(403).json({ message: "You are not assigned to this pickup" });
    }

    if (pickup.status === "completed") {
      return res.status(400).json({ message: "Pickup already completed" });
    }

    if (pickup.status !== "en_route" && pickup.status !== "assigned") {
      return res.status(400).json({ message: "Pickup must be en route or assigned to complete" });
    }

    pickup.status = "completed";
    pickup.completedAt = new Date();
    if (afterPhoto) pickup.photoUrl = afterPhoto;
    await pickup.save();

    const profile = await CollectorProfile.findOne({ userId });
    if (profile) {
      profile.activeJobs = Math.max(0, profile.activeJobs - 1);
      profile.completedJobs += 1;
      await profile.save();
    }

    return res.status(200).json({
      message: "Job marked as completed. Awaiting resident confirmation for payment release.",
      pickup,
      activeJobs: profile?.activeJobs || 0,
    });
  } catch (error) {
    console.error("Mark complete error:", error);
    return res.status(500).json({ message: "Failed to mark complete" });
  }
};

// ─── Get Earnings ───
export const getEarnings = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { period = "week" } = req.query;

    let startDate = new Date();
    switch (period) {
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "all":
        startDate = new Date(0);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    const pickups = await PickupRequest.find({
      collectorId: userId,
      status: "completed",
      completedAt: { $gte: startDate },
    }).sort({ completedAt: -1 });

    const totalAmount = pickups.reduce((sum, p) => sum + p.priceAgreed, 0);
    const totalJobs = pickups.length;

    const allPickups = await PickupRequest.find({
      collectorId: userId,
      status: "completed",
    });

    const allTimeAmount = allPickups.reduce((sum, p) => sum + p.priceAgreed, 0);
    const allTimeJobs = allPickups.length;

    const periodKey = period as string;
    const summary: any = {
      allTime: {
        amount: allTimeAmount,
        jobs: allTimeJobs,
      },
      averagePerJob: allTimeJobs > 0 ? Math.round(allTimeAmount / allTimeJobs) : 0,
    };
    summary[periodKey] = {
      amount: totalAmount,
      jobs: totalJobs,
    };

    return res.status(200).json({
      summary,
      history: pickups.map((p) => ({
        id: p._id,
        date: p.completedAt,
        neighbourhood: p.neighbourhood,
        amount: p.priceAgreed,
        wasteTypes: p.wasteTypes,
      })),
    });
  } catch (error) {
    console.error("Get earnings error:", error);
    return res.status(500).json({ message: "Failed to get earnings" });
  }
};

// ─── Get Collector Jobs ───
export const getJobs = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { status, limit = 20, page = 1 } = req.query;

    const filter: any = { collectorId: userId };
    if (status) {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const jobs = await PickupRequest.find(filter)
      .populate("residentId", "name phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await PickupRequest.countDocuments(filter);

    return res.status(200).json({
      jobs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get jobs error:", error);
    return res.status(500).json({ message: "Failed to get jobs" });
  }
};

// ─── ✅ Get Single Job by ID (FIXED) ───
export const getJobById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // ✅ Fix: Cast id to string (Express params can be string | string[])
    const id = req.params.id as string;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid job ID" });
    }

    const job = await PickupRequest.findById(id)
      .populate("residentId", "name phone")
      .populate("collectorId", "name phone");

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check if this collector is assigned to this job
    const collector = job.collectorId as any;
    if (collector?._id?.toString() !== userId) {
      return res.status(403).json({ message: "Access denied. You are not assigned to this job." });
    }

    return res.status(200).json({ job });
  } catch (error) {
    console.error("Get job by ID error:", error);
    return res.status(500).json({ message: "Failed to get job" });
  }
};

// ─── Get Chat Messages for a Job (Collector) ───
export const getJobChatMessages = async (req: AuthRequest, res: Response) => {
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

    if (pickup.collectorId?.toString() !== userId) {
      return res.status(403).json({ message: "You are not assigned to this pickup" });
    }

    const messages = await Message.find({ pickupRequestId: id })
      .populate("senderId", "name role")
      .sort({ createdAt: 1 });

    return res.status(200).json({ messages });
  } catch (error) {
    console.error("Get job chat messages error:", error);
    return res.status(500).json({ message: "Failed to get messages" });
  }
};

// ─── Send Chat Message (Collector) ───
export const sendJobChatMessage = async (req: AuthRequest, res: Response) => {
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

    if (pickup.collectorId?.toString() !== userId) {
      return res.status(403).json({ message: "You are not assigned to this pickup" });
    }

    const receiverId = pickup.residentId;

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
    console.error("Send job chat message error:", error);
    return res.status(500).json({ message: "Failed to send message" });
  }
};