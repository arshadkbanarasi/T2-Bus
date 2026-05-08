export const AUTH_ROLES = ["user", "admin", "staff", "supervisor"] as const;

export type AuthRole = (typeof AUTH_ROLES)[number];

export const normalizePhone = (value: unknown) => {
  const rawValue = String(value || "").trim();

  if (!rawValue || rawValue.includes("@")) {
    return "";
  }

  const digitsOnly = rawValue.replace(/\D+/g, "");

  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    return digitsOnly.slice(2);
  }

  return digitsOnly;
};

export const normalizeEmail = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase();

export const sanitizeRole = (value: unknown): AuthRole => {
  if (typeof value === "string" && AUTH_ROLES.includes(value as AuthRole)) {
    return value as AuthRole;
  }

  return "user";
};

export const isBcryptHash = (value: unknown) =>
  typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);

export const isAdultDate = (value: Date) => {
  const today = new Date();
  let age = today.getFullYear() - value.getFullYear();
  const monthDifference = today.getMonth() - value.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < value.getDate())
  ) {
    age -= 1;
  }

  return age >= 18;
};
