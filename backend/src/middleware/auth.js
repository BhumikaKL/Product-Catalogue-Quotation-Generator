import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const [scheme, token] = String(
    req.headers.authorization || ""
  ).split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      message: "Please sign in to continue."
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      message: "Session invalid or expired. Sign in again."
    });
  }
}

export function requireRole(...roles) {
  return (req, res, next) =>
    req.user && roles.includes(req.user.role)
      ? next()
      : res.status(403).json({
          message: "You do not have permission."
        });
}