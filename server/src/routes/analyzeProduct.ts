import { Router } from "express";
import { analyzeProductRequestSchema } from "../schemas/productSchemas.js";
import { analyzeCategory } from "../services/categoryAnalyzer.js";
import { analyzeProduct } from "../services/productAnalyzer.js";

export const analyzeProductRouter = Router();

analyzeProductRouter.post("/", async (req, res, next) => {
  try {
    const parsed = analyzeProductRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "请求体必须包含有效的 product。", details: {} } });
    }
    const category = await analyzeCategory(parsed.data.product);
    const analysis = await analyzeProduct(parsed.data.product, category);
    return res.json({ category, diagnosis: analysis.diagnosis, directions: analysis.directions });
  } catch (error) {
    return next(error);
  }
});
