import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import quotationRoutes from "./routes/quotations.js";

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error(
    "JWT_SECRET missing. Copy .env.example to .env and set it."
  );
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 5000;
const dir = path.dirname(fileURLToPath(import.meta.url));

// Enable CORS
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
  })
);

// Parse incoming JSON requests
app.use(express.json({ limit: "1mb" }));

// Serve product images
app.use(
  "/images",
  express.static(path.resolve(dir, "../public/images"))
);

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Register API routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/quotations", quotationRoutes);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(500).json({
    message: "Unexpected server error."
  });
});

// Start the server
app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
});