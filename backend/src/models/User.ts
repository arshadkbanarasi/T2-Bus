import mongoose from "mongoose";
import { normalizeEmail, normalizePhone } from "../utils/auth";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      set: (value: unknown) => normalizeEmail(value) || null,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      set: (value: unknown) => normalizePhone(value),
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "admin", "staff", "supervisor"],
      default: "user",
    },
    dob: {
      type: Date,
      required: true,
    },
    assignedBuses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bus",
      },
    ],
    managedStaff: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    joiningDate: {
      type: Date,
    },
  },
  { timestamps: true },
);

userSchema.pre("validate", function () {
  if (this.phone) {
    this.phone = normalizePhone(this.phone);
  }

  if (this.email !== undefined) {
    this.email = normalizeEmail(this.email) || null;
  }
});

const User = mongoose.model("User", userSchema);

export default User;
