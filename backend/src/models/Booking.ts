import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    seats: {
      type: [Number],
      required: true,
    },
    passengerDetails: {
      type: [
        {
          name: {
            type: String,
            trim: true,
          },
          age: Number,
          gender: String,
          seatNumber: Number,
          boardingStatus: {
            type: String,
            enum: ["not-boarded", "boarded"],
            default: "not-boarded",
          },
        },
      ],
      default: [],
    },
    luggage: {
      type: [
        {
          type: {
            type: String,
            trim: true,
            required: true,
          },
          weight: {
            type: Number,
            required: true,
            min: 0,
          },
        },
      ],
      default: [],
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["booked", "cancelled"],
      default: "booked",
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
