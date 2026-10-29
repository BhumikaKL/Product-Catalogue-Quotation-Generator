import { Router } from "express";
import jwt from "jsonwebtoken";
import { users } from "../data/store.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/login", (req, res) => {
  const username = String(req.body?.username || "")
    .trim()
    .toLowerCase();

  const password = String(req.body?.password || "");

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({
      message: "Invalid username or password."
    });
  }

  const token = jwt.sign(
    {
      sub: String(user.id),
      username: user.username,
      name: user.name,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "8h"
    }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  });
});

router.get("/me", requireAuth, (req, res) => {
  const user = users.find(
    (u) => String(u.id) === String(req.user.sub)
  );

  if (!user) {
    return res.status(401).json({
      message: "User not found."
    });
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  });
});

export default router;