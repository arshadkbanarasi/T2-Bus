import { Request, Response } from "express";
import SeatLock from "../models/SeatLock";
import { getIo } from "../socket";

export const lockSeats = async (req: any, res: Response) => {
  const { busId, seats } = req.body;
  const userId = req.user.id;

  try {
    // 🔥 STEP 1: CHECK already locked seats
    const existingLocks = await SeatLock.find({
      bus: busId,
      seatNumber: { $in: seats },
    });

    if (existingLocks.length > 0) {
      return res.status(400).json({
        message: "Some seats already locked",
        lockedSeats: existingLocks.map((lock) => lock.seatNumber),
      });
    }

    // 🔥 STEP 2: CREATE LOCKS
    const locks = seats.map((seat: number) => ({
      bus: busId,
      seatNumber: seat,
      user: userId,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    }));

    await SeatLock.insertMany(locks);

    // 🔥 STEP 3: EMIT EVENT
    getIo()?.to(busId.toString()).emit("seatLocked", {
      seats,
    });

    res.json({ message: "Seats locked for 5 minutes" });
  } catch (err) {
    res.status(400).json({
      message: "Seat lock failed",
    });
  }
};
