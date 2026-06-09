# Runway Prompt Studio

Runway Prompt Studio 是一个 iOS SwiftUI + Node.js TypeScript monorepo。当前主流程已升级为面向服装档口商户的极简拍照工作流：

```text
上传服装正面照和反面照
  ↓
AI 分析服装款式
  ↓
AI 生成或 mock 生成 1 张标准电商三视图
  ↓
确认标准三视图
  ↓
自动保存三视图到手机相册
  ↓
随机匹配本地背景图
  ↓
生成 3 段视频 Prompt
  ↓
提交 Seedance 生成视频
  ↓
复制使用
```

## Project Structure

```text
.
├── ios
│   ├── RunwayPromptStudio.xcodeproj
│   └── RunwayPromptStudio
└── server
    ├── src
    ├── assets/backgrounds
    ├── uploads/garments
    ├── generated/three-views
    ├── data
    ├── package.json
    └── .env.example
```

## Start Server

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

API starts at `http://localhost:3000`.

## Runtime Config

Codex `config.toml` only affects Codex itself. App runtime model calls are configured by `server/.env`. Do not put real API keys in source code, README, or the iOS client.

```bash
AI_PROVIDER=openox
OPENOX_BASE_URL=https://openox.tech/v1
OPENOX_API_KEY=your_key_here
OPENOX_IMAGE_API_KEY=your_image_key_here
OPENOX_MODEL=gpt-5.5
OPENOX_REASONING_EFFORT=high
OPENOX_STORE=false
OPENOX_TIMEOUT_MS=120000
LLM_MOCK_MODE=false
LLM_FALLBACK_TO_MOCK=true

VISION_MODEL=gpt-5.5
IMAGE_GENERATION_MODEL=gpt-image-1
IMAGE_GENERATION_MODE=real
IMAGE_GENERATION_FALLBACK_TO_MOCK=true
IMAGE_GENERATION_TIMEOUT_MS=180000

ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_API_KEY=your_ark_key_here
SEEDANCE_MODEL=ep-20260604164423-ggl5k
SEEDANCE_RATIO=16:9
SEEDANCE_DURATION=11
SEEDANCE_GENERATE_AUDIO=true
SEEDANCE_WATERMARK=false
SEEDANCE_REFERENCE_VIDEO_FILENAME=video-case.mp4
SEEDANCE_FALLBACK_WITHOUT_REFERENCE_VIDEO_ON_SENSITIVE=true

TOS_REGION=cn-beijing
TOS_S3_ENDPOINT=tos-s3-cn-beijing.volces.com
TOS_BUCKET=seedance-sources
TOS_BUCKET_DOMAIN=seedance-sources.tos-cn-beijing.volces.com
TOS_ACCESS_KEY_ID=your_tos_ak
TOS_SECRET_ACCESS_KEY=your_tos_sk
```

- `OPENOX_API_KEY` is used for text generation and garment photo understanding.
- `OPENOX_IMAGE_API_KEY` is used for image generation.
- Both keys only belong in `server/.env`.
- iOS never stores API keys and never calls OpenOX directly.
- `VISION_MODEL` analyzes the front/back garment photos.
- `IMAGE_GENERATION_MODEL` is used for three-view image generation or editing.
- If image generation fails, the backend falls back to mock three-view sets and the iOS UI shows a Mock notice.
- If `OPENOX_API_KEY` is empty, LLM mock mode is used automatically.
- If `OPENOX_IMAGE_API_KEY` is empty or image generation fails, three-view generation falls back to mock when enabled.

## Background Library

Put local background images in:

```text
server/assets/backgrounds/
```

Supported formats: `.jpg`, `.jpeg`, `.png`, `.webp`.

If the directory is empty, the backend returns a default fallback background and the iOS result page shows that status.

## Run iOS App

Open [ios/RunwayPromptStudio.xcodeproj](/Users/yhjt-jssg/AI-ad-e-commerce/ios/RunwayPromptStudio.xcodeproj) in Xcode, select an iPhone 13 simulator or device, and run.

The iOS client now defaults to `https://zuobin.wang`, with `http://124.221.173.111:3000` as a fallback during deployment testing. Keep all model and storage keys on the backend only.

## Main APIs

- `POST /api/garment/generate-three-view-sets`
  Multipart upload: `frontImage`, `backImage`.
- `POST /api/garment/prepare-video-prompts`
  JSON body: `sessionId`, `selectedSetId`.
- `POST /api/garment/generate-video-prompt`
  JSON body: `sessionId`, `selectedSetId`.
- `POST /api/garment/generate-video`
  JSON body: `sessionId`, `selectedSetId`, `prompt`, `deviceId`.
- `POST /api/garment/video-task-status`
  JSON body: `sessionId`, `taskId`.
- `GET /api/garment/video-quota?deviceId=...`
  Returns the daily successful-video quota for this device.
- `GET /api/garment/session-status?sessionId=...`
  Returns resumable task state for foreground recovery.
- `GET /api/backgrounds/random`
  Returns a random local background or fallback background.

Legacy 1688 endpoints are still present in the backend for compatibility, but they are no longer the iOS home entry.

## Build

```bash
cd server
npm run build
```

iOS was verified with an iPhoneOS build target and iOS 16.6 deployment target.

## Tencent Cloud Deployment

Recommended production layout:

```bash
/opt/runway-prompt-studio/server
```

Install and build:

```bash
cd /opt/runway-prompt-studio/server
npm install
npm run build
```

Run with PM2:

```bash
pm2 start dist/index.js --name runway-prompt-studio-api
pm2 save
pm2 startup
```

Nginx should proxy your domain to the Node server:

```text
https://zuobin.wang -> http://127.0.0.1:3000
```

Deployment notes:

- Use HTTPS for TestFlight builds. Avoid plain HTTP in production.
- Keep `server/.env` only on the server. Do not commit it.
- Ensure these directories exist and are writable by the Node process:
  - `server/uploads/`
  - `server/generated/`
  - `server/data/`
  - `server/assets/backgrounds/`
  - `server/assets/models/`
- Persist `server/data/garment-sessions.json` and `server/data/device-usage.json` across restarts.
- Configure Nginx upload size for garment photos, for example `client_max_body_size 50m;`.
- Keep reverse proxy timeouts comfortably above image generation time, for example 300s or more.
- Open firewall ports 80 and 443.
- Confirm the server can reach:
  - `https://openox.tech/v1`
  - `https://ark.cn-beijing.volces.com/api/v3`
  - your TOS S3 endpoint.

Daily video quota is tracked per anonymous iOS Keychain `deviceId`. Only successful video generations count toward the daily limit of 3, and quota resets at midnight in `Asia/Shanghai`.
