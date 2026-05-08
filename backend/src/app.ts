import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import { protect } from "./middleware/authMiddleware";
import { authorize } from "./middleware/roleMiddleware";
import busRoutes from "./routes/busRoutes";
import bookingRoutes from "./routes/bookingRoutes";
import luggageRoutes from "./routes/luggageRoutes";
import staffRoutes from "./routes/staffRoutes";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/luggage", luggageRoutes);
app.use("/api/staff", staffRoutes);

app.get("/", (_req, res) => {
  res.send("API is running...");
});

app.get("/api/protected", protect, (_req, res) => {
  res.json({ message: "Protected route accessed" });
});

app.get("/api/admin", protect, authorize("admin"), (_req, res) => {
  res.json({ message: "Admin access granted" });
});

app.get("/api/user", protect, authorize("user"), (_req, res) => {
  res.json({ message: "User access granted" });
});

export default app;
