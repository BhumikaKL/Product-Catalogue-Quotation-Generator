import { Router } from "express";
import { products } from "../data/store.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// GET: Retrieve all products
router.get("/", requireAuth, (_req, res) => {
  res.json(products);
});

// POST: Add a new product (Admin only)
router.post("/", requireAuth, requireRole("admin"), (req, res) => {
  const {
    model,
    name,
    price,
    image,
    description = ""
  } = req.body || {};

  const amount = Number(price);

  // Validate required fields
  if (
    !String(model || "").trim() ||
    !String(name || "").trim() ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    !String(image || "").trim()
  ) {
    return res.status(400).json({
      message: "Model, name, valid price and image filename are required."
    });
  }

  // Check for duplicate product models
  if (
    products.some(
      (p) =>
        p.model.toLowerCase() === String(model).trim().toLowerCase()
    )
  ) {
    return res.status(409).json({
      message: "Product model already exists."
    });
  }

  // Create a new product
  const product = {
    id: `product-${Date.now()}`,
    model: String(model).trim(),
    name: String(name).trim(),
    price: amount,
    image: String(image).split("/").pop(),
    description: String(description).trim()
  };

  // Add product to the product list
  products.push(product);

  res.status(201).json(product);
});

export default router;