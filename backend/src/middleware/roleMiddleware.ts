import { Response, NextFunction } from "express";

export const authorize = (...roles: string[]) => {
  return (req: any, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied",
        debug: {
          actualRole: req.user?.role || null,
          allowedRoles: roles,
          userId: req.user?._id || req.user?.id || null,
        },
      });
    }

    next();
  };
};

