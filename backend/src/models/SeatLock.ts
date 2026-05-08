import mongoose from "mongoose";

const seatLockSchema = new mongoose.Schema({
  bus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bus",
    required: true,
  },
  seatNumber: {
    type: Number,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

// 🔥 TTL INDEX (AUTO DELETE)
seatLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// 🔥 prevent duplicate locks
seatLockSchema.index({ bus: 1, seatNumber: 1 }, { unique: true });

export default mongoose.model("SeatLock", seatLockSchema);
