import { Router } from "express";
import { extractProductRequestSchema } from "../schemas/productSchemas.js";
import { ExtractionBlockedError, extractProduct, InvalidUrlError } from "../services/productExtractor.js";

export const extractProductRouter = Router();

extractProductRouter.post("/", async (req, res, next) => {
  try {
    const parsed = extractProductRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: "INVALID_REQUEST", message: "请求体必须包含 url 字段。", details: {} }
      });
    }

    const product = await extractProduct(parsed.data.url);
    return res.json(product);
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      return res.status(400).json({
        error: { code: "INVALID_URL", message: error.message, details: {} }
      });
    }

    if (error instanceof ExtractionBlockedError) {
      return res.status(403).json({
        error: { code: "EXTRACTION_BLOCKED", message: error.message, details: {} }
      });
    }

    return next(error);
  }
});
