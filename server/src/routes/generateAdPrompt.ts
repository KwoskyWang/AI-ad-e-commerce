import { Router } from "express";
import { generateAdPromptRequestSchema } from "../schemas/productSchemas.js";
import { generateAdPrompt } from "../services/promptGenerator.js";

export const generateAdPromptRouter = Router();

generateAdPromptRouter.post("/", async (req, res, next) => {
  try {
    const parsed = generateAdPromptRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: "INVALID_REQUEST", message: "请求体必须包含 product，并且 product 结构需要匹配 ProductInfo。", details: {} }
      });
    }

    const prompt = await generateAdPrompt(parsed.data.product, parsed.data.styleMode);
    return res.json(prompt);
  } catch (error) {
    return next(error);
  }
});
