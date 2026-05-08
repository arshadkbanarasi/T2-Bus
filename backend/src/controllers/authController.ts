import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { AuthRequest } from "../types/auth";
import {
  isAdultDate,
  isBcryptHash,
  normalizeEmail,
  normalizePhone,
  sanitizeRole,
} from "../utils/auth";

const signToken = (user: any) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT secret not configured");
  }

  return jwt.sign({ id: user._id, role: user.role || "user" }, secret, {
    expiresIn: "1d",
  });
};

const serializeAssignedBuses = (assignedBuses: any) =>
  Array.isArray(assignedBuses)
    ? assignedBuses.map((bus: any) =>
        bus && typeof bus === "object" && bus._id
          ? {
              _id: bus._id,
              name: bus.name,
              number: bus.busNumber,
              busNumber: bus.busNumber,
              from: bus.from,
              to: bus.to,
            }
          : bus,
      )
    : [];

const serializeUser = (user: any) => ({
  id: user._id?.toString?.() || user.id || "",
  _id: user._id,
  name: user.name,
  email: user.email || "",
  phone: user.phone,
  mobile: user.phone,
  role: user.role || "user",
  dob: user.dob,
  assignedBuses: serializeAssignedBuses(user.assignedBuses),
  managedStaff: Array.isArray(user.managedStaff) ? user.managedStaff : [],
});

const buildIdentifierQuery = (identifier: unknown) => {
  const normalizedPhone = normalizePhone(identifier);
  const normalizedEmail = normalizeEmail(identifier);
  const conditions: Record<string, string>[] = [];

  if (normalizedPhone) {
    conditions.push({ phone: normalizedPhone });
  }

  if (normalizedEmail) {
    conditions.push({ email: normalizedEmail });
  }

  return conditions;
};

const verifyPassword = async (user: any, rawPassword: string) => {
  const storedPassword = typeof user?.password === "string" ? user.password : "";

  if (!storedPassword) {
    return false;
  }

  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(rawPassword, storedPassword);
  }

  if (storedPassword !== rawPassword) {
    return false;
  }

  user.password = await bcrypt.hash(rawPassword, 10);
  await user.save();
  return true;
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password, role, dob } = req.body;

    const cleanName = String(name || "").trim();
    const cleanPhone = normalizePhone(phone);
    const cleanEmail = normalizeEmail(email);
    const cleanPassword = String(password || "");

    if (!cleanName || !cleanEmail || !cleanPhone || !cleanPassword || !dob) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone, password and date of birth are required.",
      });
    }

    if (cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid phone number.",
      });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const userExists = await User.findOne({
      $or: [{ phone: cleanPhone }, { email: cleanEmail }],
    });

    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "An account already exists with this phone or email.",
      });
    }

    const parsedDob = new Date(dob);
    if (isNaN(parsedDob.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date of birth.",
      });
    }

    if (!isAdultDate(parsedDob)) {
      return res.status(400).json({
        success: false,
        message: "You must be at least 18 years old to register.",
      });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    const userPayload: Record<string, unknown> = {
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      dob: parsedDob,
      password: hashedPassword,
      role: sanitizeRole(role),
    };

    const user = await User.create(userPayload);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token: signToken(user),
      user: serializeUser(user),
    });
  } catch (error: any) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account already exists with this phone or email.",
      });
    }

    console.log("REGISTER ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const rawIdentifier =
      req.body.identifier || req.body.phone || req.body.mobile || req.body.email;
    const identifier = String(rawIdentifier || "").trim();
    const password = String(req.body.password || "");

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Identifier and password are required.",
      });
    }

    const conditions = buildIdentifierQuery(rawIdentifier);
    if (conditions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email or phone number.",
      });
    }

    const user = await User.findOne({
      $or: conditions,
    })
      .select("+password")
      .populate("assignedBuses", "_id name busNumber from to");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    const isMatch = await verifyPassword(user, password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    res.json({
      success: true,
      message: "Login successful",
      token: signToken(user),
      user: serializeUser(user),
    });
  } catch (error) {
    console.log("LOGIN ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const me = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.id)
      .select("-password")
      .populate("assignedBuses", "_id name busNumber from to");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.json({
      success: true,
      user: serializeUser(user),
    });
  } catch (error) {
    console.log("ME ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
