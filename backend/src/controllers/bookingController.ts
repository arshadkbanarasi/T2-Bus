import { Response } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking";
import Bus from "../models/Bus";
import SeatLock from "../models/SeatLock";
import User from "../models/User";
import { getIo } from "../socket";
import { razorpay } from "../config/razorpay";

const BUS_SELECT_FIELDS = "_id name busNumber from to departureTime arrivalTime";

const getAssignedBusIds = (assignedBuses: any) =>
  Array.isArray(assignedBuses)
    ? assignedBuses
        .map((bus: any) => bus?.toString?.() ?? bus)
        .filter(Boolean)
    : [];

const normalizePassengerDetails = (passengerDetails: any, seats: number[]) => {
  if (!Array.isArray(passengerDetails)) {
    return [];
  }

  return passengerDetails.map((passenger: any, index: number) => ({
    name: passenger?.name || "",
    age: Number(passenger?.age || 0),
    gender: passenger?.gender || "",
    seatNumber: Number(passenger?.seatNumber || seats[index] || 0),
    boardingStatus:
      passenger?.boardingStatus === "boarded" ? "boarded" : "not-boarded",
  }));
};

const normalizeLuggage = (luggage: any) => {
  if (!Array.isArray(luggage)) {
    return [];
  }

  return luggage
    .map((item: any) => ({
      type: String(item?.type || "").trim(),
      weight: Number(item?.weight || 0),
    }))
    .filter((item) => item.type && item.weight >= 0);
};

const formatBooking = (booking: any) => {
  const formatted = booking.toObject ? booking.toObject() : { ...booking };

  if (formatted.bus && typeof formatted.bus === "object" && formatted.bus._id) {
    formatted.bus = {
      ...formatted.bus,
      number: formatted.bus.busNumber,
      busId: formatted.bus._id,
    };
    formatted.busId = formatted.bus._id;
  } else if (formatted.bus) {
    formatted.busId = formatted.bus;
  }

  formatted.totalFare = formatted.totalPrice;
  formatted.luggage = Array.isArray(formatted.luggage) ? formatted.luggage : [];
  formatted.passengerDetails = Array.isArray(formatted.passengerDetails)
    ? formatted.passengerDetails
    : [];

  return formatted;
};

const getAccessibleBookingQuery = async (req: any) => {
  if (req.user.role === "admin") {
    return { admin: req.user.id };
  }

  if (req.user.role === "supervisor" || req.user.role === "staff") {
    const user = await User.findById(req.user.id).select("assignedBuses");
    return {
      bus: {
        $in: getAssignedBusIds(user?.assignedBuses),
      },
    };
  }

  return { user: req.user.id };
};

// ================= CREATE BOOKING =================
export const createBooking = async (req: any, res: Response) => {
  const {
    busId,
    seats,
    totalPrice,
    passengerDetails = [],
    luggage = [],
  } = req.body;
  const userId = req.user.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const locks = await SeatLock.find({
      bus: busId,
      seatNumber: { $in: seats },
      user: userId,
    }).session(session);

    if (locks.length !== seats.length) {
      throw new Error("Seats not locked or expired");
    }

    const updatedBus = await Bus.findOneAndUpdate(
      {
        _id: busId,
        availableSeats: { $all: seats },
      },
      {
        $pull: { availableSeats: { $in: seats } },
      },
      { new: true, session },
    );

    if (!updatedBus) {
      throw new Error("Some seats already booked");
    }

    const booking = new Booking({
      user: userId,
      bus: busId,
      admin: updatedBus.admin,
      seats,
      passengerDetails: normalizePassengerDetails(passengerDetails, seats),
      luggage: normalizeLuggage(luggage),
      totalPrice,
      status: "booked",
    });

    await booking.save({ session });

    await SeatLock.deleteMany(
      {
        bus: busId,
        seatNumber: { $in: seats },
        user: userId,
      },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    getIo()?.to(busId.toString()).emit("seatBooked", { seats });

    res.status(201).json({
      message: "Booking successful",
      booking: formatBooking(booking),
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();

    res.status(400).json({
      message: error.message || "Booking failed",
    });
  }
};

// ================= USER BOOKINGS =================
export const getMyBookings = async (req: any, res: any) => {
  try {
    const bookings = await Booking.find({
      user: req.user.id,
    })
      .populate("bus", BUS_SELECT_FIELDS)
      .sort({ createdAt: -1 });

    res.json(bookings.map(formatBooking));
  } catch {
    res.status(500).json({ message: "Failed to fetch bookings" });
  }
};

// ================= ADMIN/SUPERVISOR/STAFF BOOKINGS =================
export const getAllBookings = async (req: any, res: any) => {
  try {
    const query = await getAccessibleBookingQuery(req);

    const bookings = await Booking.find(query)
      .populate("bus", BUS_SELECT_FIELDS)
      .populate("user", "_id name email phone role")
      .sort({ createdAt: -1 });

    res.json(bookings.map(formatBooking));
  } catch {
    res.status(500).json({ message: "Failed to fetch bookings" });
  }
};

// ================= UPDATE BOARDING STATUS =================
export const updateBoardingStatus = async (req: any, res: any) => {
  try {
    const query = await getAccessibleBookingQuery(req);
    const booking = await Booking.findOne({
      ...query,
      _id: req.params.id,
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const seatNumber = Number(req.body.seatNumber);
    const boardingStatus =
      req.body.boardingStatus === "boarded" ? "boarded" : "not-boarded";

    const updatedPassengerDetails = Array.isArray(booking.passengerDetails)
      ? booking.passengerDetails.map((passenger: any) =>
          Number(passenger.seatNumber) === seatNumber
            ? { ...passenger.toObject?.(), ...passenger, boardingStatus }
            : passenger,
        )
      : [];

    booking.set("passengerDetails", updatedPassengerDetails);
    booking.markModified("passengerDetails");

    await booking.save();

    res.json({
      message: "Boarding status updated",
      booking: formatBooking(booking),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Update failed" });
  }
};

// ================= CANCEL BOOKING =================
export const cancelBooking = async (req: any, res: any) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Already cancelled" });
    }

    const bus = await Bus.findById(booking.bus);

    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    bus.availableSeats = [
      ...new Set([...bus.availableSeats, ...booking.seats]),
    ];
    bus.availableSeats.sort((a: number, b: number) => a - b);
    await bus.save();

    booking.status = "cancelled";
    booking.refundAmount = booking.totalPrice * 0.8;
    await booking.save();

    res.json({ message: "Booking cancelled" });
  } catch (err) {
    console.log("CANCEL ERROR:", err);
    res.status(500).json({ message: "Cancel failed" });
  }
};

// ================= CREATE PAYMENT ORDER =================
export const createOrder = async (req: any, res: any) => {
  try {
    const { amount } = req.body;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
    });

    res.json(order);
  } catch {
    res.status(500).json({ message: "Order creation failed" });
  }
};
