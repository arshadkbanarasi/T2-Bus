import mongoose from "mongoose";

const luggageHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["loaded", "in-transit", "arrived", "delivered"],
      required: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    updatedByName: {
      type: String,
      trim: true,
      default: "",
    },
    updatedByPhone: {
      type: String,
      trim: true,
      default: "",
    },
    time: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const luggageSchema = new mongoose.Schema(
  {
    luggageId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    senderPhone: {
      type: String,
      required: true,
      trim: true,
    },
    receiverName: {
      type: String,
      required: true,
      trim: true,
    },
    receiverPhone: {
      type: String,
      required: true,
      trim: true,
    },
    from: {
      type: String,
      required: true,
      trim: true,
    },
    to: {
      type: String,
      required: true,
      trim: true,
    },
    currentLocation: {
      type: String,
      required: true,
      trim: true,
    },
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    staffContacts: {
      type: [
        {
          name: {
            type: String,
            required: true,
            trim: true,
          },
          phone: {
            type: String,
            required: true,
            trim: true,
          },
        },
      ],
      validate: {
        validator: (value: Array<{ name: string; phone: string }>) => value.length === 2,
        message: "Exactly two staff contacts are required",
      },
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["loaded", "in-transit", "arrived", "delivered"],
      default: "loaded",
    },
    history: {
      type: [luggageHistorySchema],
      default: [],
    },
    senderMessage: {
      type: String,
      default: "",
    },
    receiverMessage: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

const Luggage = mongoose.model("Luggage", luggageSchema);

export default Luggage;
