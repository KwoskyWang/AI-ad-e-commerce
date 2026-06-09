import { Router } from "express";
import { generateCreativeAssetsRequestSchema } from "../schemas/productSchemas.js";
import { generateCreativeAssets } from "../services/creativeAssetGenerator.js";

export const generateCreativeAssetsRouter = Router();

generateCreativeAssetsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = generateCreativeAssetsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "请求体必须包含有效的 product。", details: {} } });
    }
    return res.json(await generateCreativeAssets(parsed.data));
  } catch (error) {
    return next(error);
  }
});
