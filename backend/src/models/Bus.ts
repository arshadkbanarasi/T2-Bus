import mongoose from "mongoose";


const busSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    name: {
      type: String,
      required: true,
    },
    busNumber: {
      type: String,
      required: true,
      unique: true,
    },
    from: {
      type: String,
      required: true,
    },
    to: {
      type: String,
      required: true,
    },
    departureTime: {
      type: String,
      required: true,
    },
    arrivalTime: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    totalSeats: {
      type: Number,
      required: true,
    },
    availableSeats: {
      type: [Number],
      required: true,
    },
    driverName: String,
    driverPhone: String,
    conductorName: String,
    conductorPhone: String,
    busType: String,
    amenities: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);


const Bus = mongoose.model("Bus", busSchema);

export default Bus;
