import express from "express";
import {
  createStaff,
  getStaff,
  updateStaff,
} from "../controllers/staffController";

import { allowRoles, protect } from "../middleware/authMiddleware";

const router = express.Router();

// ✅ ADMIN + SUPERVISOR
router.post("/", protect, allowRoles("admin", "supervisor"), createStaff);
router.get("/", protect, allowRoles("admin", "supervisor"), getStaff);
router.put("/:id", protect, allowRoles("admin", "supervisor"), updateStaff);

export default router;
