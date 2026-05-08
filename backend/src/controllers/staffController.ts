import { Request, Response } from "express";
import User from "../models/User";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Bus from "../models/Bus";

const BUS_SELECT_FIELDS = "_id name busNumber from to";

const normalizeObjectIds = (items: any) => {
  if (!Array.isArray(items)) {
    return [] as mongoose.Types.ObjectId[];
  }

  return [
    ...new Set(
      items
        .map((item: any) => {
          if (typeof item === "string") {
            return item;
          }

          if (item instanceof mongoose.Types.ObjectId) {
            return item.toString();
          }

          if (item && typeof item === "object" && typeof item._id === "string") {
            return item._id;
          }

          return null;
        })
        .filter(
          (id: string | null): id is string =>
            !!id && mongoose.Types.ObjectId.isValid(id),
        ),
    ),
  ].map((id) => new mongoose.Types.ObjectId(id));
};

const formatAssignedBuses = (staff: any) => {
  const formatted = staff.toObject ? staff.toObject() : { ...staff };

  formatted.assignedBuses = Array.isArray(formatted.assignedBuses)
    ? formatted.assignedBuses.map((bus: any) => {
        if (bus && typeof bus === "object" && bus._id) {
          return {
            _id: bus._id,
            name: bus.name,
            number: bus.busNumber,
            busNumber: bus.busNumber,
            from: bus.from,
            to: bus.to,
          };
        }

        return bus;
      })
    : [];

  return formatted;
};

const syncSupervisorAssignments = async (staff: any) => {
  if (staff.role !== "supervisor") {
    await Bus.updateMany({ supervisor: staff._id }, { $set: { supervisor: null } });
    return;
  }

  const assignedBusIds = normalizeObjectIds(staff.assignedBuses).map((id) =>
    id.toString(),
  );

  await Bus.updateMany(
    { supervisor: staff._id, _id: { $nin: assignedBusIds } },
    { $set: { supervisor: null } },
  );

  if (assignedBusIds.length > 0) {
    await Bus.updateMany(
      { _id: { $in: assignedBusIds } },
      { $set: { supervisor: staff._id } },
    );
  }
};

// ================= CREATE STAFF =================
export const createStaff = async (req: any, res: Response) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      assignedBuses,
      managedStaff,
      dob,
      joiningDate,
    } = req.body;

    console.log("BODY:", req.body);

    if (!name || !phone || !password || !dob || !joiningDate) {
      return res.status(400).json({
        message: "Name, phone, password, dob & joiningDate required",
      });
    }

    const cleanPhone = phone.trim();
    const cleanEmail = email ? email.trim().toLowerCase() : undefined;
    const hashedPassword = await bcrypt.hash(password, 10);
    const parsedDob = new Date(dob);
    const parsedJoining = new Date(joiningDate);

    if (isNaN(parsedDob.getTime()) || isNaN(parsedJoining.getTime())) {
      return res.status(400).json({
        message: "Invalid date format",
      });
    }

    const finalRole = role === "supervisor" ? "supervisor" : "staff";
    const safeAssignedBuses = normalizeObjectIds(assignedBuses);

    let safeManagedStaff: mongoose.Types.ObjectId[] = [];

    if (finalRole === "supervisor" && Array.isArray(managedStaff)) {
      safeManagedStaff = normalizeObjectIds(managedStaff);
    }

    const staff = await User.create({
      name,
      ...(cleanEmail && { email: cleanEmail }),
      phone: cleanPhone,
      password: hashedPassword,
      role: finalRole,
      assignedBuses: safeAssignedBuses,
      managedStaff: safeManagedStaff,
      createdBy: req.user._id,
      dob: parsedDob,
      joiningDate: parsedJoining,
    });

    if (req.user.role === "supervisor") {
      await User.findByIdAndUpdate(req.user._id, {
        $addToSet: { managedStaff: staff._id },
      });
    }

    await syncSupervisorAssignments(staff);

    await staff.populate("assignedBuses", BUS_SELECT_FIELDS);

    res.status(201).json({
      message: "Staff created successfully",
      staff: formatAssignedBuses(staff),
    });
  } catch (err: any) {
    console.log("CREATE STAFF ERROR:", err);

    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        message: `${field} already exists`,
      });
    }

    res.status(500).json({
      message: err.message || "Server error",
    });
  }
};

// ================= GET STAFF =================
export const getStaff = async (req: any, res: Response) => {
  try {
    let staff: any[] = [];

    if (req.user.role === "admin") {
      staff = await User.find({
        createdBy: req.user._id,
        role: { $in: ["staff", "supervisor"] },
      }).populate("assignedBuses", BUS_SELECT_FIELDS);
    } else if (req.user.role === "supervisor") {
      const [managedStaff, supervisor] = await Promise.all([
        User.find({
          _id: { $in: Array.isArray(req.user.managedStaff) ? req.user.managedStaff : [] },
        }).populate("assignedBuses", BUS_SELECT_FIELDS),
        User.findById(req.user._id).populate("assignedBuses", BUS_SELECT_FIELDS),
      ]);

      staff = supervisor
        ? [supervisor, ...managedStaff.filter((item) => item.id !== supervisor.id)]
        : managedStaff;
    }

    res.json(staff.map(formatAssignedBuses));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch staff" });
  }
};

// ================= UPDATE STAFF =================
export const updateStaff = async (req: any, res: Response) => {
  try {
    const {
      name,
      email,
      phone,
      role,
      assignedBuses,
      managedStaff,
      joiningDate,
    } = req.body;

    const staff = await User.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    if (req.user.role === "supervisor") {
      if (
        !staff.createdBy ||
        staff.createdBy.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          message: "Not allowed",
        });
      }
    }

    if (name) staff.name = name;
    if (email) staff.email = email.trim().toLowerCase();
    if (phone) staff.phone = phone;

    if (role === "staff" || role === "supervisor") {
      staff.role = role;
    }

    if (assignedBuses !== undefined) {
      staff.assignedBuses = normalizeObjectIds(assignedBuses);
    }

    if (staff.role === "supervisor") {
      staff.managedStaff = normalizeObjectIds(managedStaff);
    } else {
      staff.managedStaff = [];
    }

    if (joiningDate) {
      const parsedJoining = new Date(joiningDate);
      if (!isNaN(parsedJoining.getTime())) {
        staff.joiningDate = parsedJoining;
      }
    }

    await staff.save();
    await syncSupervisorAssignments(staff);
    await staff.populate("assignedBuses", BUS_SELECT_FIELDS);

    res.json({
      message: "Staff updated successfully",
      staff: formatAssignedBuses(staff),
    });
  } catch (err: any) {
    console.log("UPDATE STAFF ERROR:", err);

    res.status(500).json({
      message: err.message || "Update failed",
    });
  }
};
