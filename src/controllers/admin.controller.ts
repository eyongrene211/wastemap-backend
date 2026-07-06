import { Request, Response } from "express";
import mongoose              from "mongoose";
import { User }              from "../models/User.model";
import { CollectorProfile }  from "../models/CollectorProfile.model";
import { PickupRequest }     from "../models/PickupRequest.model";
import { Message }           from "../models/Message.model";
import { AuthRequest }       from "../middleware/auth.middleware";

// ─── Dashboard Stats ───
export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalUsers,
      totalCollectors,
      totalResidents,
      totalPickups,
      completedPickups,
      pendingPickups,
      pendingKYC,
      totalRevenue,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "collector" }),
      User.countDocuments({ role: "resident" }),
      PickupRequest.countDocuments(),
      PickupRequest.countDocuments({ status: "completed" }),
      PickupRequest.countDocuments({ status: "pending" }),
      CollectorProfile.countDocuments({ kycStatus: "pending" }),
      PickupRequest.aggregate([
        { $match: { status: "completed", paymentStatus: "released" } },
        { $group: { _id: null, total: { $sum: "$priceAgreed" } } },
      ]),
    ]);

    // Get today's pickups
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pickupsToday = await PickupRequest.countDocuments({
      createdAt: { $gte: today },
    });

    // Get recent activity (last 10 events)
    const recentActivity = await PickupRequest.find()
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate("residentId", "name")
      .populate("collectorId", "name");

    return res.status(200).json({
      stats: {
        totalUsers,
        totalCollectors,
        totalResidents,
        totalPickups,
        completedPickups,
        pendingPickups,
        pendingKYC,
        pickupsToday,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
      recentActivity: recentActivity.map((p) => ({
        id: p._id,
        resident: (p.residentId as any)?.name || "Unknown",
        collector: (p.collectorId as any)?.name || "Unassigned",
        status: p.status,
        neighbourhood: p.neighbourhood,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Get stats error:", error);
    return res.status(500).json({ message: "Failed to get stats" });
  }
};

// ─── Get All Users ───
export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { role, status, search, limit = 20, page = 1 } = req.query;

    const filter: any = {};
    if (role) filter.role = role;
    if (status === "suspended") filter.isSuspended = true;
    if (status === "active") filter.isSuspended = false;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const users = await User.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await User.countDocuments(filter);

    // Get collector profiles for collector users
    const userIds = users.filter((u) => u.role === "collector").map((u) => u._id);
    const collectorProfiles = await CollectorProfile.find({
      userId: { $in: userIds },
    });

    const usersWithProfile = users.map((user) => {
      if (user.role === "collector") {
        const profile = collectorProfiles.find(
          (p) => p.userId.toString() === user._id.toString()
        );
        return { ...user.toObject(), collectorProfile: profile || null };
      }
      return user;
    });

    return res.status(200).json({
      users: usersWithProfile,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({ message: "Failed to get users" });
  }
};

// ─── Suspend / Activate User ───
export const suspendUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { suspended } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(403).json({ message: "Cannot suspend admin accounts" });
    }

    user.isSuspended = suspended;
    await user.save();

    return res.status(200).json({
      message: `User ${suspended ? "suspended" : "activated"} successfully`,
      user: {
        id: user._id,
        name: user.name,
        isSuspended: user.isSuspended,
      },
    });
  } catch (error) {
    console.error("Suspend user error:", error);
    return res.status(500).json({ message: "Failed to suspend user" });
  }
};

// ─── Get Pending KYC ───
export const getPendingKYC = async (req: AuthRequest, res: Response) => {
  try {
    const pendingProfiles = await CollectorProfile.find({
      kycStatus: "pending",
    }).populate("userId", "name phone email");

    return res.status(200).json({
      applications: pendingProfiles.map((profile) => ({
        id: profile._id,
        name: (profile.userId as any)?.name || "Unknown",
        phone: (profile.userId as any)?.phone || "",
        email: (profile.userId as any)?.email || "",
        vehicleType: profile.vehicleType,
        acceptedWasteTypes: profile.acceptedWasteTypes,
        serviceArea: profile.serviceArea,
        submittedAt: profile.createdAt,
      })),
      count: pendingProfiles.length,
    });
  } catch (error) {
    console.error("Get pending KYC error:", error);
    return res.status(500).json({ message: "Failed to get KYC applications" });
  }
};

// ─── Approve KYC ───
export const approveKYC = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const profile = await CollectorProfile.findById(id);
    if (!profile) {
      return res.status(404).json({ message: "KYC application not found" });
    }

    if (profile.kycStatus !== "pending") {
      return res.status(400).json({ message: "KYC already processed" });
    }

    profile.kycStatus = "approved";
    await profile.save();

    // Also update the user's verified status
    await User.findByIdAndUpdate(profile.userId, { isVerified: true });

    return res.status(200).json({
      message: "KYC approved successfully",
      profile,
    });
  } catch (error) {
    console.error("Approve KYC error:", error);
    return res.status(500).json({ message: "Failed to approve KYC" });
  }
};

// ─── Reject KYC ───
export const rejectKYC = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    const profile = await CollectorProfile.findById(id);
    if (!profile) {
      return res.status(404).json({ message: "KYC application not found" });
    }

    if (profile.kycStatus !== "pending") {
      return res.status(400).json({ message: "KYC already processed" });
    }

    profile.kycStatus = "rejected";
    profile.kycRejectionReason = reason;
    await profile.save();

    return res.status(200).json({
      message: "KYC rejected",
      profile,
    });
  } catch (error) {
    console.error("Reject KYC error:", error);
    return res.status(500).json({ message: "Failed to reject KYC" });
  }
};

// ─── Get All Pickups (Admin) ───
export const getAllPickups = async (req: AuthRequest, res: Response) => {
  try {
    const { status, limit = 20, page = 1, startDate, endDate } = req.query;

    const filter: any = {};
    if (status) filter.status = status;

    if (startDate) {
      filter.createdAt = { $gte: new Date(startDate as string) };
    }
    if (endDate) {
      filter.createdAt = {
        ...filter.createdAt,
        $lte: new Date(endDate as string),
      };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const pickups = await PickupRequest.find(filter)
      .populate("residentId", "name phone")
      .populate("collectorId", "name phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await PickupRequest.countDocuments(filter);

    return res.status(200).json({
      pickups: pickups.map((p) => ({
        id: p._id,
        resident: (p.residentId as any)?.name || "Unknown",
        residentPhone: (p.residentId as any)?.phone || "",
        collector: (p.collectorId as any)?.name || "Unassigned",
        collectorPhone: (p.collectorId as any)?.phone || "",
        neighbourhood: p.neighbourhood,
        wasteTypes: p.wasteTypes,
        amount: p.priceAgreed,
        status: p.status,
        paymentStatus: p.paymentStatus,
        createdAt: p.createdAt,
      })),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get all pickups error:", error);
    return res.status(500).json({ message: "Failed to get pickups" });
  }
};

// ─── Get All Chats ───
export const getAllChats = async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50, page = 1 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Get all conversations (grouped by pickup request)
    const messages = await Message.find()
      .populate("senderId", "name role")
      .populate("receiverId", "name role")
      .populate("pickupRequestId", "residentId collectorId status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Message.countDocuments();

    // Group messages by pickup request
    const conversations: any = {};
    messages.forEach((msg) => {
      const key = (msg.pickupRequestId as any)?._id?.toString();
      if (key) {
        if (!conversations[key]) {
          conversations[key] = {
            pickupRequestId: msg.pickupRequestId,
            messages: [],
          };
        }
        conversations[key].messages.push({
          id: msg._id,
          content: msg.content,
          sender: (msg.senderId as any)?.name || "Unknown",
          senderRole: (msg.senderId as any)?.role || "unknown",
          receiver: (msg.receiverId as any)?.name || "Unknown",
          receiverRole: (msg.receiverId as any)?.role || "unknown",
          createdAt: msg.createdAt,
          readAt: msg.readAt,
        });
      }
    });

    return res.status(200).json({
      conversations: Object.values(conversations),
      total,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get chats error:", error);
    return res.status(500).json({ message: "Failed to get chats" });
  }
};

// ─── Get Reports ───
export const getReports = async (req: AuthRequest, res: Response) => {
  try {
    const { period = "week" } = req.query; // week, month, quarter, year

    let startDate = new Date();
    switch (period) {
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "quarter":
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case "year":
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    // Pickups by day
    const pickupsByDay = await PickupRequest.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          revenue: { $sum: "$priceAgreed" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Revenue by day
    const revenueByDay = await PickupRequest.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          paymentStatus: "released",
          status: "completed",
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$priceAgreed" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Top collectors
    const topCollectors = await PickupRequest.aggregate([
      { $match: { status: "completed", collectorId: { $exists: true } } },
      {
        $group: {
          _id: "$collectorId",
          completedJobs: { $sum: 1 },
          revenue: { $sum: "$priceAgreed" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "collector",
        },
      },
      { $unwind: "$collector" },
      { $sort: { completedJobs: -1 } },
      { $limit: 10 },
    ]);

    return res.status(200).json({
      period,
      pickupsByDay,
      revenueByDay,
      topCollectors: topCollectors.map((c) => ({
        name: c.collector.name,
        completedJobs: c.completedJobs,
        revenue: c.revenue,
      })),
    });
  } catch (error) {
    console.error("Get reports error:", error);
    return res.status(500).json({ message: "Failed to get reports" });
  }
};