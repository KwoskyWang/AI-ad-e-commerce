import { Router } from "express";
import { imageGenerationConfig } from "../services/imageGeneration/config.js";
import { llmConfig } from "../services/llm/config.js";
import { generatePlainText } from "../services/llm/llmClient.js";

export const llmRouter = Router();

llmRouter.get("/health", (_req, res) => {
  res.json({
    provider: llmConfig.provider,
    baseURL: llmConfig.baseURL,
    model: llmConfig.model,
    reasoningEffort: llmConfig.reasoningEffort,
    store: llmConfig.store,
    mockMode: llmConfig.mockMode,
    fallbackToMock: llmConfig.fallbackToMock,
    hasApiKey: Boolean(llmConfig.apiKey),
    hasTextApiKey: Boolean(llmConfig.apiKey),
    imageGeneration: {
      baseURL: imageGenerationConfig.baseURL,
      model: imageGenerationConfig.model,
      mode: imageGenerationConfig.mode,
      fallbackToMock: imageGenerationConfig.fallbackToMock,
      hasApiKey: Boolean(imageGenerationConfig.apiKey)
    }
  });
});

llmRouter.post("/test", async (req, res, next) => {
  try {
    const message = typeof req.body?.message === "string" && req.body.message.trim()
      ? req.body.message.trim()
      : "请返回一句中文测试文本";
    const text = await generatePlainText({
      taskName: "procurement_insight_generation",
      systemPrompt: "你是一个简洁的中文测试助手，只返回用户请求的测试文本。",
      userPrompt: message,
      mockResult: "OpenOX / GPT-5.5 mock 测试文本：创意分析服务已进入演示模式。",
      maxOutputTokens: 300
    });

    res.json({
      ok: true,
      provider: llmConfig.provider,
      model: llmConfig.model,
      mockMode: llmConfig.mockMode,
      text
    });
  } catch (error) {
    next(error);
  }
});
