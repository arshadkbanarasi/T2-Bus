import express from "express";
import {
  createBooking,
  getMyBookings,
  cancelBooking,
  createOrder,
  getAllBookings,
  updateBoardingStatus,
} from "../controllers/bookingController";
import { protect } from "../middleware/authMiddleware";
import { lockSeats } from "../controllers/seatLockController";
import { authorize } from "../middleware/roleMiddleware";






const router = express.Router();

router.post("/", protect, createBooking);
router.post("/lock", protect, lockSeats);
router.post("/create-order", protect, createOrder);
router.get("/my", protect, getMyBookings);
router.patch("/:id/cancel", protect, cancelBooking);
router.get("/all", protect, authorize("admin", "supervisor", "staff"), getAllBookings);
router.patch(
  "/:id/boarding",
  protect,
  authorize("admin", "supervisor", "staff"),
  updateBoardingStatus,
);

export default router;
