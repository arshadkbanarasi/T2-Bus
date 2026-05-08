import { Response } from "express";
import Luggage from "../models/Luggage";
import User from "../models/User";

const LUGGAGE_SELECT_BUS = "_id name busNumber from to";

const getAssignedBusIds = (assignedBuses: any) =>
  Array.isArray(assignedBuses)
    ? assignedBuses
        .map((bus: any) => bus?.toString?.() ?? bus)
        .filter(Boolean)
    : [];

const getAccessibleLuggageQuery = async (req: any) => {
  if (req.user?.role === "admin") {
    return { createdBy: req.user.id };
  }

  if (req.user?.role === "supervisor" || req.user?.role === "staff") {
    const currentUser = await User.findById(req.user.id).select("assignedBuses");
    return {
      bus: {
        $in: getAssignedBusIds(currentUser?.assignedBuses),
      },
    };
  }

  return {
    $or: [{ senderPhone: req.user?.phone }, { receiverPhone: req.user?.phone }],
  };
};

const formatLuggage = (luggage: any) => {
  const formatted = luggage.toObject ? luggage.toObject() : { ...luggage };

  if (formatted.bus && typeof formatted.bus === "object" && formatted.bus._id) {
    formatted.bus = {
      _id: formatted.bus._id,
      name: formatted.bus.name,
      number: formatted.bus.busNumber,
      busNumber: formatted.bus.busNumber,
      from: formatted.bus.from,
      to: formatted.bus.to,
    };
    formatted.busId = formatted.bus._id;
  } else if (formatted.bus) {
    formatted.busId = formatted.bus;
  }

  formatted.trackingLink = `/luggage-track?id=${formatted.luggageId}`;
  return formatted;
};

const buildNotificationMessage = (
  recipientName: string,
  luggageId: string,
  trackingUrl: string,
  roleLabel: string,
) =>
  `Hello ${recipientName}, your ${roleLabel} luggage ID is ${luggageId}. Track status here: ${trackingUrl}`;

export const createLuggage = async (req: any, res: Response) => {
  try {
    const {
      senderName,
      senderPhone,
      receiverName,
      receiverPhone,
      from,
      to,
      currentLocation,
      busId,
      staffContacts,
    } = req.body;

    if (
      !senderName ||
      !senderPhone ||
      !receiverName ||
      !receiverPhone ||
      !from ||
      !to ||
      !currentLocation ||
      !busId
    ) {
      return res.status(400).json({ message: "All luggage fields are required" });
    }

    const safeStaffContacts = Array.isArray(staffContacts)
      ? staffContacts
          .map((item: any) => ({
            name: String(item?.name || "").trim(),
            phone: String(item?.phone || "").trim(),
          }))
          .filter((item: { name: string; phone: string }) => item.name && item.phone)
      : [];

    if (safeStaffContacts.length !== 2) {
      return res.status(400).json({
        message: "Please provide exactly two staff contacts",
      });
    }

    const accessQuery = await getAccessibleLuggageQuery(req);
    if (req.user.role === "staff" || req.user.role === "supervisor") {
      const allowedBusIds = Array.isArray(accessQuery.bus?.$in) ? accessQuery.bus.$in : [];
      if (!allowedBusIds.map(String).includes(String(busId))) {
        return res.status(403).json({ message: "You cannot add luggage for this bus" });
      }
    }

    const luggageId = `LUG-${Date.now()}`;
    const trackingUrl = `${req.protocol}://${req.get("host")}/luggage-track?id=${luggageId}`;

    const luggage = await Luggage.create({
      luggageId,
      senderName: String(senderName).trim(),
      senderPhone: String(senderPhone).trim(),
      receiverName: String(receiverName).trim(),
      receiverPhone: String(receiverPhone).trim(),
      from: String(from).trim(),
      to: String(to).trim(),
      currentLocation: String(currentLocation).trim(),
      bus: busId,
      staffContacts: safeStaffContacts,
      createdBy: req.user.id,
      status: "loaded",
      history: [
        {
          status: "loaded",
          location: String(currentLocation).trim(),
          note: "Luggage created",
          updatedByName: req.user.name || "",
          updatedByPhone: req.user.phone || "",
          time: new Date(),
        },
      ],
      senderMessage: buildNotificationMessage(senderName, luggageId, trackingUrl, "sender"),
      receiverMessage: buildNotificationMessage(receiverName, luggageId, trackingUrl, "receiver"),
    });

    await luggage.populate("bus", LUGGAGE_SELECT_BUS);

    res.status(201).json({
      message: "Luggage added successfully",
      luggage: formatLuggage(luggage),
      notifications: {
        sender: {
          phone: String(senderPhone).trim(),
          message: luggage.senderMessage,
        },
        receiver: {
          phone: String(receiverPhone).trim(),
          message: luggage.receiverMessage,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to create luggage" });
  }
};

export const getAllLuggage = async (req: any, res: Response) => {
  try {
    const query = await getAccessibleLuggageQuery(req);
    const luggage = await Luggage.find(query)
      .populate("bus", LUGGAGE_SELECT_BUS)
      .sort({ createdAt: -1 });

    res.json(luggage.map(formatLuggage));
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch luggage" });
  }
};

export const getLuggageById = async (req: any, res: Response) => {
  try {
    const luggage = await Luggage.findOne({
      luggageId: req.params.luggageId,
    }).populate("bus", LUGGAGE_SELECT_BUS);

    if (!luggage) {
      return res.status(404).json({ message: "Luggage not found" });
    }

    res.json(formatLuggage(luggage));
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch luggage" });
  }
};

export const getLuggageByReceiverPhone = async (req: any, res: Response) => {
  try {
    const receiverPhone = String(req.params.receiverPhone || "").trim();

    if (!receiverPhone) {
      return res.status(400).json({ message: "Receiver phone is required" });
    }

    const luggage = await Luggage.find({
      receiverPhone,
    })
      .populate("bus", LUGGAGE_SELECT_BUS)
      .sort({ createdAt: -1 });

    if (!luggage.length) {
      return res.status(404).json({ message: "No luggage found for this phone number" });
    }

    res.json(luggage.map(formatLuggage));
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch luggage" });
  }
};

export const updateLuggageStatus = async (req: any, res: Response) => {
  try {
    const query = await getAccessibleLuggageQuery(req);
    const luggage = await Luggage.findOne({
      ...query,
      _id: req.params.id,
    }).populate("bus", LUGGAGE_SELECT_BUS);

    if (!luggage) {
      return res.status(404).json({ message: "Luggage not found" });
    }

    const allowedStatuses = ["loaded", "in-transit", "arrived", "delivered"];
    const status = allowedStatuses.includes(req.body.status) ? req.body.status : luggage.status;
    const location = String(req.body.location || luggage.currentLocation).trim();
    const note = String(req.body.note || "").trim();

    luggage.status = status;
    luggage.currentLocation = location;
    luggage.history.push({
      status,
      location,
      note,
      updatedByName: req.user.name || "",
      updatedByPhone: req.user.phone || "",
      time: new Date(),
    } as any);

    await luggage.save();

    res.json({
      message: "Luggage status updated",
      luggage: formatLuggage(luggage),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to update luggage" });
  }
};
