
import { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

import { products } from "../data/store.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const dir = path.dirname(fileURLToPath(import.meta.url));
const imageRoot = path.resolve(dir, "../../public/images");

const SHARP_RED = "#D71920";
const TEXT_COLOR = "#26332F";
const MUTED_COLOR = "#52605B";
const BORDER_COLOR = "#D9E0DC";

const clean = (value, maxLength = 140) =>
  String(value ?? "").trim().slice(0, maxLength);

const money = (value) =>
  `INR ${Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

router.post("/pdf", requireAuth, (req, res, next) => {
  try {
    const {
      productIds,
      customer,
      quantity = 1,
      gstRate = 18,
    } = req.body || {};

    // Validate selected products.
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        message: "Select at least one product.",
      });
    }

    // Salespeople can generate a quotation for one product only.
    if (
      req.user.role === "salesperson" &&
      productIds.length !== 1
    ) {
      return res.status(403).json({
        message:
          "Salespeople can include only one product per PDF.",
      });
    }

    if (productIds.length > 50) {
      return res.status(400).json({
        message: "Maximum 50 products per quotation.",
      });
    }

    const chosen = productIds.map((id) =>
      products.find((product) => product.id === String(id))
    );

    if (chosen.some((product) => !product)) {
      return res.status(404).json({
        message: "Selected product not found.",
      });
    }

    // Validate customer information.
    if (!clean(customer?.name)) {
      return res.status(400).json({
        message: "Customer name is required.",
      });
    }

    const qty = Number(quantity);
    const rate = Number(gstRate);

    if (!Number.isInteger(qty) || qty < 1 || qty > 10000) {
      return res.status(400).json({
        message:
          "Quantity must be a whole number from 1 to 10,000.",
      });
    }

    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({
        message: "GST must be between 0 and 100.",
      });
    }

    // Calculate quotation amounts.
    const subtotal = chosen.reduce(
      (sum, product) => sum + product.price * qty,
      0
    );

    const tax = (subtotal * rate) / 100;
    const total = subtotal + tax;

    const quote = `SH-${new Date()
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "")}-${Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase()}`;

    // Configure PDF download response.
    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Quotation-${quote}.pdf"`
    );

    const doc = new PDFDocument({
      size: "A4",
      margins: {
        top: 40,
        bottom: 40,
        left: 45,
        right: 45,
      },
      info: {
        Title: `Quotation ${quote}`,
        Author: clean(req.user.name),
      },
    });

    doc.on("error", next);
    doc.pipe(res);

    const pageWidth = doc.page.width;

    // --------------------------------------------------
    // SHARP RED HEADER
    // --------------------------------------------------

     // White background
doc.rect(0, 0, pageWidth, 82).fill("#FFFFFF");

// SHARP company name in red only
doc
  .fillColor("#D71920")
  .font("Helvetica-Bold")
  .fontSize(24)
  .text("SHARP", 45, 20);

// Subtitle in the existing dark text color
doc
  .fillColor("#26332F")
  .font("Helvetica")
  .fontSize(9)
  .text("PRODUCT QUOTATION", 46, 53);

    // --------------------------------------------------
    // QUOTATION DETAILS
    // --------------------------------------------------

    doc
      .fillColor(TEXT_COLOR)
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("Quotation", 45, 101);

    doc
      .fillColor(MUTED_COLOR)
      .font("Helvetica")
      .fontSize(9);

    doc.text(`Quotation no: ${quote}`, 45, 128);

    doc.text(
      `Date: ${new Date().toLocaleDateString("en-IN")}`,
      45,
      142
    );

    doc.text(
      `Prepared by: ${clean(req.user.name)}`,
      45,
      156
    );

    // --------------------------------------------------
    // CUSTOMER DETAILS
    // --------------------------------------------------

    doc
      .fillColor(TEXT_COLOR)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("CUSTOMER", 45, 188);

    doc
      .moveTo(45, 205)
      .lineTo(550, 205)
      .strokeColor(BORDER_COLOR)
      .stroke();

    doc
      .fillColor(TEXT_COLOR)
      .font("Helvetica")
      .fontSize(9);

    doc.text(`Name: ${clean(customer.name)}`, 45, 216);

    doc.text(
      `Company: ${clean(customer.company) || "-"}`,
      45,
      230
    );

    doc.text(
      `Email: ${clean(customer.email) || "-"}`,
      45,
      244
    );

    doc.text(
      `Phone: ${clean(customer.phone) || "-"}`,
      45,
      258
    );

    // --------------------------------------------------
    // SELECTED PRODUCTS
    // --------------------------------------------------

    let y = 288;

    for (const product of chosen) {
      if (y > 600) {
        doc.addPage();
        y = 48;
      }

      doc
        .fillColor(TEXT_COLOR)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(product.name, 45, y, {
          width: 270,
        });

      doc
        .fillColor(MUTED_COLOR)
        .font("Helvetica")
        .fontSize(9)
        .text(`Model: ${product.model}`, 45, y + 17);

      doc.text(`Quantity: ${qty}`, 45, y + 31);

      doc.text(
        `Unit price: ${money(product.price)}`,
        45,
        y + 45
      );

      // Product amount in Sharp red.
      doc
        .fillColor(SHARP_RED)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(
          `Amount: ${money(product.price * qty)}`,
          45,
          y + 59
        );

      // Product image.
      try {
        const imagePath = path.resolve(
          imageRoot,
          path.basename(product.image)
        );

        doc.image(imagePath, 350, y, {
          fit: [170, 95],
          align: "center",
          valign: "center",
        });
      } catch {
        doc
          .rect(350, y, 170, 80)
          .fill("#F0F3F1");

        doc
          .fillColor(MUTED_COLOR)
          .font("Helvetica")
          .fontSize(8)
          .text("Image unavailable", 360, y + 35, {
            width: 150,
            align: "center",
          });
      }

      y += 112;

      doc
        .moveTo(45, y - 6)
        .lineTo(550, y - 6)
        .strokeColor(BORDER_COLOR)
        .stroke();
    }

    // --------------------------------------------------
    // PRICE SUMMARY
    // --------------------------------------------------

    if (y > 655) {
      doc.addPage();
      y = 55;
    }

    y += 5;

    doc
      .fillColor(MUTED_COLOR)
      .font("Helvetica")
      .fontSize(10)
      .text("Subtotal", 350, y);

    doc.text(money(subtotal), 435, y, {
      width: 115,
      align: "right",
    });

    doc.text(`GST (${rate}%)`, 350, y + 19);

    doc.text(money(tax), 435, y + 19, {
      width: 115,
      align: "right",
    });

    doc
      .moveTo(350, y + 40)
      .lineTo(550, y + 40)
      .strokeColor(BORDER_COLOR)
      .stroke();

    // Grand total in Sharp red.
    doc
      .fillColor(SHARP_RED)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("GRAND TOTAL", 350, y + 51);

    doc.text(money(total), 435, y + 51, {
      width: 115,
      align: "right",
    });

    // --------------------------------------------------
    // FOOTER
    // --------------------------------------------------

    doc
      .fillColor(MUTED_COLOR)
      .font("Helvetica")
      .fontSize(8)
      .text(
        "This quotation is not a tax invoice. Confirm prices, GST, delivery and payment terms before acceptance.",
        45,
        770,
        {
          width: 505,
        }
      );

    doc.end();
  } catch (error) {
    next(error);
  }
});

export default router;
