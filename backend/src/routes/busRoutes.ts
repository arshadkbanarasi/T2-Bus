import express from "express";
import { optionalProtect, protect } from "../middleware/authMiddleware";
import { authorize } from "../middleware/roleMiddleware";
import {
  createBus,
  deleteBus,
  getBusById,
  getBuses,
  getPublicBuses,
  updateBus,
} from "../controllers/busController";

const router = express.Router();

router.get("/public", getPublicBuses);
router.post("/", protect, authorize("admin"), createBus);
router.get("/", optionalProtect, getBuses);
router.get("/:id", optionalProtect, getBusById);
router.put("/:id", protect, authorize("admin"), updateBus);
router.delete("/:id", protect, authorize("admin"), deleteBus);

export default router;
