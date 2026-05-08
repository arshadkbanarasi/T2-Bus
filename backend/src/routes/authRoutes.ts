import express from "express";
import { login, me, register } from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/register", register);
router.post("/signup", register);
router.post("/login", login);
router.post("/signin", login);
router.get("/me", protect, me);

export default router;
