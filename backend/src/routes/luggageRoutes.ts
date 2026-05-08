import express from "express";
import {
  createLuggage,
  getAllLuggage,
  getLuggageById,
  getLuggageByReceiverPhone,
  updateLuggageStatus,
} from "../controllers/luggageController";
import { protect } from "../middleware/authMiddleware";
import { authorize } from "../middleware/roleMiddleware";

const router = express.Router();

router.get("/track/:luggageId", getLuggageById);
router.get("/receiver/:receiverPhone", getLuggageByReceiverPhone);
router.get("/", protect, authorize("admin", "supervisor", "staff"), getAllLuggage);
router.post("/", protect, authorize("admin", "supervisor", "staff"), createLuggage);
router.patch("/:id/status", protect, authorize("admin", "supervisor", "staff"), updateLuggageStatus);

export default router;
