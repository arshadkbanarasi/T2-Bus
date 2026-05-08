import { Request, Response } from "express";
import Bus from "../models/Bus";
import User from "../models/User";

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getAssignedBusIds = (assignedBuses: any) =>
  Array.isArray(assignedBuses)
    ? assignedBuses.map((bus: any) => bus?.toString?.() ?? bus).filter(Boolean)
    : [];

const getBusQueryForRole = async (req: any, includeRouteFilters = true) => {
  const from = includeRouteFilters
    ? req.query.from || req.query.source || req.query.origin
    : undefined;

  const to = includeRouteFilters
    ? req.query.to || req.query.destination
    : undefined;

  const query: Record<string, unknown> = {};

  if (typeof from === "string" && from.trim()) {
    query.from = new RegExp(`^${escapeRegex(from.trim())}$`, "i");
  }

  if (typeof to === "string" && to.trim()) {
    query.to = new RegExp(`^${escapeRegex(to.trim())}$`, "i");
  }

  if (!req.user) {
    return query;
  }

  if (req.user.role === "admin") {
    query.admin = req.user.id;
    return query;
  }

  if (req.user.role === "supervisor" || req.user.role === "staff") {
    const user = await User.findById(req.user.id).select("assignedBuses");
    query._id = { $in: getAssignedBusIds(user?.assignedBuses) };
  }

  return query;
};

export const getPublicBuses = async (_req: Request, res: Response) => {
  try {
    const buses = await Bus.find().sort({ createdAt: -1 });
    res.json(buses);
  } catch (error: any) {
    console.error("PUBLIC BUS ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getBuses = async (req: any, res: Response) => {
  try {
    const query = await getBusQueryForRole(req);
    const buses = await Bus.find(query).sort({ createdAt: -1 });
    res.json(buses);
  } catch (error: any) {
    console.error("GET BUSES ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getBusById = async (req: Request, res: Response) => {
  try {
    const bus = await Bus.findById(req.params.id);

    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    res.json(bus);
  } catch (error: any) {
    console.error("GET BUS BY ID ERROR:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

export const createBus = async (req: any, res: any) => {
  try {
    const totalSeats = parseInt(req.body.totalSeats, 10);

    const bus = await Bus.create({
      ...req.body,
      admin: req.user.id,
      totalSeats,
      availableSeats: Array.from({ length: totalSeats }, (_, i) => i + 1),
    });

    res.status(201).json({
      message: "Bus added successfully",
      bus,
    });
  } catch (error: any) {
    console.error("BUS CREATE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

export const updateBus = async (req: any, res: any) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const bus = await Bus.findOne({
      _id: req.params.id,
      admin: req.user.id,
    });

    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    bus.name = req.body.name ?? bus.name;
    bus.busNumber = req.body.busNumber ?? req.body.number ?? bus.busNumber;
    bus.from = req.body.from ?? bus.from;
    bus.to = req.body.to ?? bus.to;
    bus.departureTime =
      req.body.departureTime ?? req.body.departure ?? bus.departureTime;
    bus.arrivalTime =
      req.body.arrivalTime ?? req.body.arrival ?? bus.arrivalTime;
    bus.price = req.body.price ?? bus.price;
    bus.driverName = req.body.driverName ?? bus.driverName;
    bus.driverPhone = req.body.driverPhone ?? bus.driverPhone;
    bus.conductorName = req.body.conductorName ?? bus.conductorName;
    bus.conductorPhone = req.body.conductorPhone ?? bus.conductorPhone;
    bus.busType = req.body.busType ?? bus.busType;
    bus.supervisor = req.body.supervisor ?? bus.supervisor;

    if (Array.isArray(req.body.amenities)) {
      bus.amenities = req.body.amenities;
    }

    await bus.save();
    res.json(bus);
  } catch (error: any) {
    console.error("UPDATE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteBus = async (req: any, res: any) => {
  try {
    const bus = await Bus.findOneAndDelete({
      _id: req.params.id,
      admin: req.user.id,
    });

    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    res.json({ message: "Bus deleted" });
  } catch (error: any) {
    console.error("DELETE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
