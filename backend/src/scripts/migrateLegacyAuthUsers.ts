import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import connectDB from "../config/db";
import User from "../models/User";
import { isBcryptHash, normalizeEmail, normalizePhone } from "../utils/auth";

dotenv.config();

const migrateLegacyAuthUsers = async () => {
  await connectDB();

  const users = await User.find().select("+password");

  let updatedCount = 0;
  let hashedLegacyPasswords = 0;
  const skipped: string[] = [];

  for (const user of users) {
    let shouldSave = false;

    const normalizedPhone = normalizePhone(user.phone);
    if (!normalizedPhone) {
      skipped.push(`${user._id}: missing/invalid phone`);
      continue;
    }

    if (normalizedPhone !== user.phone) {
      const duplicatePhone = await User.findOne({
        _id: { $ne: user._id },
        phone: normalizedPhone,
      }).lean();

      if (duplicatePhone) {
        skipped.push(`${user._id}: phone conflict -> ${normalizedPhone}`);
        continue;
      }

      user.phone = normalizedPhone;
      shouldSave = true;
    }

    const normalizedEmail = normalizeEmail(user.email);
    if (normalizedEmail !== (user.email || "")) {
      if (normalizedEmail) {
        const duplicateEmail = await User.findOne({
          _id: { $ne: user._id },
          email: normalizedEmail,
        }).lean();

        if (duplicateEmail) {
          skipped.push(`${user._id}: email conflict -> ${normalizedEmail}`);
          continue;
        }
      }

      user.email = normalizedEmail || null;
      shouldSave = true;
    }

    const storedPassword = typeof user.password === "string" ? user.password : "";
    if (!isBcryptHash(storedPassword)) {
      if (!storedPassword.trim()) {
        skipped.push(`${user._id}: empty legacy password`);
        continue;
      }

      user.password = await bcrypt.hash(storedPassword, 10);
      hashedLegacyPasswords += 1;
      shouldSave = true;
    }

    if (shouldSave) {
      await user.save();
      updatedCount += 1;
    }
  }

  console.log("Legacy auth migration complete.");
  console.log(`Users updated: ${updatedCount}`);
  console.log(`Legacy passwords re-hashed: ${hashedLegacyPasswords}`);

  if (skipped.length > 0) {
    console.log("Skipped records:");
    skipped.forEach((entry) => console.log(`- ${entry}`));
  }
};

void migrateLegacyAuthUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Legacy auth migration failed:", error);
    process.exit(1);
  });
