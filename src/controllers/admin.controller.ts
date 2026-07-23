import { Request, Response } from "express";
import mongoose              from "mongoose";
import { User }              from "../models/User.model";
import { CollectorProfile }  from "../models/CollectorProfile.model";
import { PickupRequest }     from "../models/PickupRequest.model";
import { Payment }           from "../models/Payment.model";
import { Message }           from "../models/Message.model";
import { AuthRequest }       from "../middleware/auth.middleware";

// ─── Helper: format time ago ───
function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

// ─── Dashboard Stats ───
export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalUsers,
      totalCollectors,
      pendingKYC,
      totalPickups,
      completedPickups,
      pendingPickups,
      totalRevenue,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "collector" }),
      CollectorProfile.countDocuments({ kycStatus: "pending" }),
      PickupRequest.countDocuments(),
      PickupRequest.countDocuments({ status: "completed" }),
      PickupRequest.countDocuments({ status: { $in: ["pending", "assigned", "en_route"] } }),
      PickupRequest.aggregate([
        { $match: { status: "completed", paymentStatus: "released" } },
        { $group: { _id: null, total: { $sum: "$priceAgreed" } } },
      ]),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pickupsToday = await PickupRequest.countDocuments({
      createdAt: { $gte: today },
    });

    const activeCollectors = await CollectorProfile.countDocuments({
      availability: "online",
    });

    const completionRate = totalPickups > 0
      ? Math.round((completedPickups / totalPickups) * 100)
      : 0;

    // Dummy growth for now
    const revenueGrowth = 12.5;

    res.status(200).json({
      stats: {
        totalUsers,
        totalCollectors,
        pendingKYC,
        totalPickups,
        pickupsToday,
        revenue: totalRevenue[0]?.total || 0,
        revenueGrowth,
        activeCollectors,
        completionRate,
      },
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({ message: "Failed to get stats" });
  }
};

// ─── Recent Activity ───
export const getRecentActivity = async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const recentPickups = await PickupRequest.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate("residentId", "name")
      .populate("collectorId", "name");

    const activities = recentPickups.map((p) => {
      const resident = p.residentId as any;
      let action = "";
      let type: "pickup" | "request" | "kyc" | "collector" = "pickup";
      let user = resident?.name || "Unknown";

      switch (p.status) {
        case "completed":
          action = "completed pickup";
          type = "pickup";
          break;
        case "pending":
          action = "requested pickup";
          type = "request";
          break;
        case "assigned":
          action = "assigned to collector";
          type = "request";
          break;
        default:
          action = `updated pickup (${p.status})`;
          type = "pickup";
      }

      return {
        id: p._id.toString(),
        user,
        action,
        neighbourhood: p.neighbourhood,
        time: formatTimeAgo(p.updatedAt),
        type,
      };
    });

    res.status(200).json({ activities });
  } catch (error) {
    console.error("Get recent activity error:", error);
    res.status(500).json({ message: "Failed to get recent activity" });
  }
};

// ─── Get All Users ───
export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { role, status, search, limit = 20, page = 1 } = req.query;

    const filter: any = {};
    if (role && role !== "all") filter.role = role;
    if (status === "suspended") filter.isSuspended = true;
    if (status === "active") filter.isSuspended = false;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const users = await User.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await User.countDocuments(filter);

    const userIds = users.filter((u) => u.role === "collector").map((u) => u._id);
    const profiles = await CollectorProfile.find({ userId: { $in: userIds } });
    const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

    const usersWithStatus = users.map((user) => {
      const profile = profileMap.get(user._id.toString());
      let status = user.isSuspended ? "suspended" : "active";
      if (user.role === "collector" && profile && profile.kycStatus === "pending") {
        status = "pending_kyc";
      }
      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email || "",
        phone: user.phone,
        role: user.role,
        status,
        joinedAt: user.createdAt.toISOString(),
      };
    });

    res.status(200).json({
      users: usersWithStatus,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Failed to get users" });
  }
};

// ─── Get Single User Detail ───
export const getUserDetail = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let collectorProfile = null;
    if (user.role === "collector") {
      collectorProfile = await CollectorProfile.findOne({ userId: user._id });
    }

    const pickups = await PickupRequest.find({
      $or: [{ residentId: user._id }, { collectorId: user._id }],
    })
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({
      user,
      collectorProfile,
      recentPickups: pickups,
    });
  } catch (error) {
    console.error("Get user detail error:", error);
    return res.status(500).json({ message: "Failed to get user detail" });
  }
};

// ─── Suspend/Activate User (unified) ───
export const toggleSuspendUser = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body; // "active" or "suspended"

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(403).json({ message: "Cannot suspend admin account" });
    }

    const isSuspended = status === "suspended";
    user.isSuspended = isSuspended;
    await user.save();

    res.status(200).json({
      message: `User ${isSuspended ? "suspended" : "activated"} successfully`,
      user: {
        id: user._id,
        name: user.name,
        isSuspended: user.isSuspended,
      },
    });
  } catch (error) {
    console.error("Toggle suspend error:", error);
    res.status(500).json({ message: "Failed to update user status" });
  }
};

// ─── Legacy Suspend/Activate (kept for compatibility) ───
export const suspendUser = async (req: AuthRequest, res: Response) => {
  // Redirect to toggleSuspendUser
  return toggleSuspendUser(req, res);
};

export const activateUser = async (req: AuthRequest, res: Response) => {
  // Redirect to toggleSuspendUser
  return toggleSuspendUser(req, res);
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
        idDocument: profile.kycIdDocumentUrl,
        selfiePhoto: profile.kycSelfiePhotoUrl,
        submittedAt: profile.kycSubmittedAt || profile.createdAt,
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
    const id = req.params.id as string;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid KYC ID" });
    }

    const profile = await CollectorProfile.findById(id);
    if (!profile) {
      return res.status(404).json({ message: "KYC application not found" });
    }

    if (profile.kycStatus !== "pending") {
      return res.status(400).json({ message: "KYC already processed" });
    }

    profile.kycStatus = "approved";
    await profile.save();

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
    const id = req.params.id as string;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid KYC ID" });
    }

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

// ─── Get All Pickups (Admin) - For frontend table ───
export const getPickups = async (req: AuthRequest, res: Response) => {
  try {
    const { status, limit = 20, page = 1, search } = req.query;

    const filter: any = {};
    if (status && status !== "all") filter.status = status;

    if (search) {
      filter.$or = [
        { neighbourhood: { $regex: search, $options: "i" } },
        { addressDescription: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const pickups = await PickupRequest.find(filter)
      .populate("residentId", "name")
      .populate("collectorId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await PickupRequest.countDocuments(filter);

    const formatted = pickups.map((p) => {
      const resident = p.residentId as any;
      const collector = p.collectorId as any;
      return {
        id: p._id.toString(),
        resident: resident?.name || "Unknown",
        neighbourhood: p.neighbourhood,
        wasteType: p.wasteTypes[0] || "General",
        collector: collector?.name || null,
        amount: p.priceAgreed,
        status: p.status,
        date: p.createdAt.toISOString(),
      };
    });

    res.status(200).json({
      pickups: formatted,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get pickups error:", error);
    res.status(500).json({ message: "Failed to get pickups" });
  }
};

// ─── Legacy getAllPickups (kept for compatibility) ───
export const getAllPickups = async (req: AuthRequest, res: Response) => {
  return getPickups(req, res);
};

// ─── Get Single Pickup Detail (Admin) ───
export const getPickupDetail = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid pickup ID" });
    }

    const pickup = await PickupRequest.findById(id)
      .populate("residentId", "name phone")
      .populate("collectorId", "name phone");

    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    const messages = await Message.find({ pickupRequestId: id })
      .populate("senderId", "name role")
      .sort({ createdAt: 1 });

    const payment = await Payment.findOne({ pickupRequestId: id });

    return res.status(200).json({
      pickup,
      messages,
      payment,
    });
  } catch (error) {
    console.error("Get pickup detail error:", error);
    return res.status(500).json({ message: "Failed to get pickup detail" });
  }
};

// ─── Get Chat Conversations (Admin) ───
export const getChatConversations = async (req: AuthRequest, res: Response) => {
  try {
    const pickupIds = await Message.distinct("pickupRequestId");
    const conversations = [];

    for (const pickupId of pickupIds) {
      const pickup = await PickupRequest.findById(pickupId)
        .populate("residentId", "name phone")
        .populate("collectorId", "name phone");
      if (!pickup) continue;

      const lastMessage = await Message.findOne({ pickupRequestId: pickupId })
        .sort({ createdAt: -1 });

      const resident = pickup.residentId as any;
      const collector = pickup.collectorId as any;

      if (!resident) continue;

      conversations.push({
        pickupId: pickup._id.toString(),
        resident: {
          _id: resident._id.toString(),
          name: resident.name,
          phone: resident.phone,
        },
        collector: collector
          ? {
              _id: collector._id.toString(),
              name: collector.name,
              phone: collector.phone,
            }
          : null,
        lastMessage: lastMessage?.content || "",
        lastMessageTime: lastMessage?.createdAt?.toISOString() || pickup.createdAt.toISOString(),
        unreadCount: 0,
        status: pickup.status,
      });
    }

    conversations.sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );

    res.status(200).json({ conversations });
  } catch (error) {
    console.error("Get chat conversations error:", error);
    res.status(500).json({ message: "Failed to get chat conversations" });
  }
};

// ─── Get Chat Messages (Admin) ───
export const getChatMessages = async (req: AuthRequest, res: Response) => {
  try {
    const pickupId = req.params.pickupId as string;

    if (!mongoose.Types.ObjectId.isValid(pickupId)) {
      return res.status(400).json({ message: "Invalid pickup ID" });
    }

    const messages = await Message.find({ pickupRequestId: pickupId })
      .populate("senderId", "name role")
      .populate("receiverId", "name role")
      .sort({ createdAt: 1 });

    res.status(200).json({ messages });
  } catch (error) {
    console.error("Get chat messages error:", error);
    res.status(500).json({ message: "Failed to get chat messages" });
  }
};

// ─── Get Reports ───
export const getReports = async (req: AuthRequest, res: Response) => {
  try {
    const { period = "week" } = req.query;

    let startDate = new Date();
    let days = 7;
    switch (period) {
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        days = 7;
        break;
      case "month":
        startDate.setMonth(startDate.getMonth() - 1);
        days = 30;
        break;
      case "quarter":
        startDate.setMonth(startDate.getMonth() - 3);
        days = 90;
        break;
      case "year":
        startDate.setFullYear(startDate.getFullYear() - 1);
        days = 365;
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
        days = 7;
    }

    const newUsers = await User.countDocuments({
      createdAt: { $gte: startDate },
    });
    const newCollectors = await User.countDocuments({
      role: "collector",
      createdAt: { $gte: startDate },
    });
    const pickups = await PickupRequest.countDocuments({
      createdAt: { $gte: startDate },
    });
    const revenue = await PickupRequest.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          paymentStatus: "released",
          status: "completed",
        },
      },
      { $group: { _id: null, total: { $sum: "$priceAgreed" } } },
    ]);

    const pickupsByDay = await PickupRequest.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          value: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: days },
    ]);

    const revenueByWeek = await PickupRequest.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          paymentStatus: "released",
          status: "completed",
        },
      },
      {
        $group: {
          _id: { $week: "$createdAt" },
          value: { $sum: "$priceAgreed" },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 7 },
    ]);

    const labels = pickupsByDay.map((d) => d._id.substring(5)); // MM-DD
    const pickupsValues = pickupsByDay.map((d) => d.value);
    const revenueValues = revenueByWeek.map((d) => d.value);

    res.status(200).json({
      newUsers,
      newCollectors,
      pickups,
      revenue: revenue[0]?.total || 0,
      pickupsByDay: labels.map((label, i) => ({
        label,
        value: pickupsValues[i] || 0,
      })),
      revenueByWeek: revenueValues.map((v, i) => ({
        label: `W${i + 1}`,
        value: v || 0,
      })),
    });
  } catch (error) {
    console.error("Get reports error:", error);
    res.status(500).json({ message: "Failed to get reports" });
  }
};

// ─── Settings ───
export const getSettings = async (req: AuthRequest, res: Response) => {
  // In a real app, fetch from a Settings collection. For now return defaults.
  res.status(200).json({
    defaultLanguage: "en",
    dataRetention: "1 year",
    securityLevel: "Standard",
    version: "v1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
};

export const updateSettings = async (req: AuthRequest, res: Response) => {
  const { defaultLanguage, dataRetention, securityLevel } = req.body;
  // In a real app, save to DB. For now just return updated.
  res.status(200).json({
    defaultLanguage: defaultLanguage || "en",
    dataRetention: dataRetention || "1 year",
    securityLevel: securityLevel || "Standard",
    version: "v1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
};