import { Request, Response } from "express";
import mongoose              from "mongoose";
import { User }              from "../models/User.model";
import { CollectorProfile }  from "../models/CollectorProfile.model";
import { PickupRequest }     from "../models/PickupRequest.model";
import { Message }           from "../models/Message.model";
import { Payment }           from "../models/Payment.model"; // <-- FIXED: Missing import
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pickupsToday = await PickupRequest.countDocuments({
      createdAt: { $gte: today },
    });

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

// ─── Get Single User Detail ───
export const getUserDetail = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string; // <-- FIXED: Explicit cast to string

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

// ─── Suspend User ───
export const suspendUser = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string; // <-- FIXED: Explicit cast to string
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(403).json({ message: "Cannot suspend admin accounts" });
    }

    user.isSuspended = true;
    await user.save();

    return res.status(200).json({
      message: "User suspended successfully",
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

// ─── Activate User ───
export const activateUser = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string; // <-- FIXED: Explicit cast to string

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(403).json({ message: "Admin accounts cannot be suspended" });
    }

    user.isSuspended = false;
    await user.save();

    return res.status(200).json({
      message: "User activated successfully",
      user: {
        id: user._id,
        name: user.name,
        isSuspended: user.isSuspended,
      },
    });
  } catch (error) {
    console.error("Activate user error:", error);
    return res.status(500).json({ message: "Failed to activate user" });
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
    const id = req.params.id as string; // <-- FIXED: Explicit cast to string

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
    const id = req.params.id as string; // <-- FIXED: Explicit cast to string
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

// ─── Get All Pickups (Admin) ───
export const getAllPickups = async (req: AuthRequest, res: Response) => {
  try {
    const { status, limit = 20, page = 1, startDate, endDate, search } = req.query;

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

    if (search) {
      filter.$or = [
        { neighbourhood: { $regex: search, $options: "i" } },
        { addressDescription: { $regex: search, $options: "i" } },
      ];
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

// ─── Get Single Pickup Detail (Admin) ───
export const getPickupDetail = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string; // <-- FIXED: Explicit cast to string

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

    const payment = await Payment.findOne({ pickupRequestId: id }); // <-- FIXED: Now works with import

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
    // Get all pickups that have messages
    const pickupsWithChat = await PickupRequest.aggregate([
      {
        $lookup: {
          from: "messages",
          localField: "_id",
          foreignField: "pickupRequestId",
          as: "messages",
        },
      },
      { $match: { "messages.0": { $exists: true } } },
      {
        $project: {
          residentId: 1,
          collectorId: 1,
          status: 1,
          messages: 1,
        },
      },
    ]);

    const conversations = await Promise.all(
      pickupsWithChat.map(async (pickup) => {
        const resident = await User.findById(pickup.residentId).select("name phone");
        const collector = pickup.collectorId
          ? await User.findById(pickup.collectorId).select("name phone")
          : null;

        const lastMessage = pickup.messages[pickup.messages.length - 1];
        const unreadCount = pickup.messages.filter(
          (m: any) => !m.readAt && m.senderId.toString() !== req.user?.userId
        ).length;

        return {
          pickupId: pickup._id,
          resident: resident || { name: "Unknown", phone: "" },
          collector: collector || { name: "Unassigned", phone: "" },
          lastMessage: lastMessage?.content || "",
          lastMessageTime: lastMessage?.createdAt || pickup.createdAt,
          unreadCount,
          status: pickup.status,
        };
      })
    );

    // Sort by last message time (newest first)
    conversations.sort(
      (a, b) =>
        new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );

    return res.status(200).json({ conversations });
  } catch (error) {
    console.error("Get chat conversations error:", error);
    return res.status(500).json({ message: "Failed to get conversations" });
  }
};

// ─── Get Chat Messages (Admin) ───
export const getChatMessages = async (req: AuthRequest, res: Response) => {
  try {
    const pickupId = req.params.pickupId as string; // <-- FIXED: Explicit cast to string

    if (!pickupId || !mongoose.Types.ObjectId.isValid(pickupId)) {
      return res.status(400).json({ message: "Invalid pickup ID" });
    }

    const pickup = await PickupRequest.findById(pickupId);
    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    const messages = await Message.find({ pickupRequestId: pickupId })
      .populate("senderId", "name role")
      .populate("receiverId", "name role")
      .sort({ createdAt: 1 });

    return res.status(200).json({ messages });
  } catch (error) {
    console.error("Get chat messages error:", error);
    return res.status(500).json({ message: "Failed to get messages" });
  }
};

// ─── Get Reports ───
export const getReports = async (req: AuthRequest, res: Response) => {
  try {
    const { period = "week" } = req.query;

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