import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { analyzeProductRouter } from "./routes/analyzeProduct.js";
import { extract1688ProductRouter } from "./routes/extract1688Product.js";
import { extractProductRouter } from "./routes/extractProduct.js";
import { generateCreativeAssetsRouter } from "./routes/generateCreativeAssets.js";
import { generateAdPromptRouter } from "./routes/generateAdPrompt.js";
import { backgroundsRouter, garmentRouter } from "./routes/garment.js";
import { llmRouter } from "./routes/llm.js";
import { backgroundsDir, ensureRuntimeDirs, garmentUploadsDir, modelsDir, threeViewsDir } from "./services/garmentPaths.js";
import { LLMProviderError } from "./services/llm/types.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
await ensureRuntimeDirs();

app.use("/uploads/garments", express.static(garmentUploadsDir));
app.use("/generated/three-views", express.static(threeViewsDir));
app.use("/assets/backgrounds", express.static(backgroundsDir));
app.use("/assets/models", express.static(modelsDir));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "Runway Prompt Studio API" });
});

app.use("/api/extract-product", extractProductRouter);
app.use("/api/extract-1688-product", extract1688ProductRouter);
app.use("/api/analyze-product", analyzeProductRouter);
app.use("/api/generate-ad-prompt", generateAdPromptRouter);
app.use("/api/generate-creative-assets", generateCreativeAssetsRouter);
app.use("/api/llm", llmRouter);
app.use("/api/garment", garmentRouter);
app.use("/api/backgrounds", backgroundsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof LLMProviderError) {
    return res.status(err.code === "LLM_TIMEOUT" ? 504 : 502).json({
      error: {
        code: err.code,
        message: llmErrorMessage(err.code),
        details: {
          provider: err.provider,
          model: err.model,
          status: err.status
        }
      }
    });
  }

  if (err instanceof Error && "code" in err && "status" in err) {
    const typed = err as Error & { code: string; status: number };
    return res.status(typed.status).json({
      error: {
        code: typed.code,
        message: typed.message,
        details: {}
      }
    });
  }

  console.error(err instanceof Error ? { name: err.name, message: err.message } : err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "服务暂时不可用，请稍后再试。",
      details: {}
    }
  });
});

app.listen(port, () => {
  console.log(`Runway Prompt Studio API listening on http://localhost:${port}`);
});

function llmErrorMessage(code: string): string {
  switch (code) {
    case "LLM_TIMEOUT":
      return "创意分析服务响应超时，请稍后重试。";
    case "LLM_PROVIDER_ERROR":
      return "创意分析服务暂时不可用，请稍后重试。";
    case "LLM_JSON_PARSE_ERROR":
      return "创意结果解析失败，请重新生成。";
    case "LLM_EMPTY_RESPONSE":
      return "创意分析服务返回为空，请稍后重试。";
    default:
      return "创意分析服务暂时不可用，请稍后重试。";
  }
}
