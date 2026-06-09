import { Router } from "express";
import { extractProductRequestSchema } from "../schemas/productSchemas.js";
import { extract1688Product, is1688Url } from "../services/1688Extractor.js";
import { parseHttpUrl } from "../utils/url.js";

export const extract1688ProductRouter = Router();

extract1688ProductRouter.post("/", async (req, res, next) => {
  try {
    const parsed = extractProductRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "请求体必须包含 url 字段。", details: {} } });
    }
    const url = parseHttpUrl(parsed.data.url);
    if (!url || !is1688Url(url)) {
      return res.status(400).json({ error: { code: "INVALID_1688_URL", message: "当前 Demo 仅支持 1688 商品详情页链接。", details: {} } });
    }
    const product = await extract1688Product(url);
    return res.json(product);
  } catch (error) {
    return next(error);
  }
});
