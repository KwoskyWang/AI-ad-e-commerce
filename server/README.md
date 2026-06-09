# Runway Prompt Studio Server

Node.js + TypeScript backend for the garment photo workflow.

## New Main Flow

```text
Upload garment front/back photos
  ↓
Analyze garment style with VISION_MODEL
  ↓
Generate or mock 4 three-view sets
  ↓
Select one set
  ↓
Pick a random local background
  ↓
Generate 3 video prompts
```

## Scripts

```bash
npm install
npm run dev
npm run build
npm start
```

## GPT-5.5 / OpenOX Runtime Config

Create `server/.env` from `.env.example`. Codex `config.toml` only affects Codex itself; app runtime calls use `server/.env`.

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
```

Notes:

- `OPENOX_API_KEY` is used for text generation and garment photo understanding.
- `OPENOX_IMAGE_API_KEY` is used for image generation.
- Both keys only belong in `server/.env`.
- Do not write real API keys into source code, README, logs, or the iOS client.
- `VISION_MODEL` is used for garment photo understanding.
- `IMAGE_GENERATION_MODEL` is used for three-view image generation or editing.
- If your provider supports image generation with `gpt-5.5`, set `IMAGE_GENERATION_MODEL=gpt-5.5`.
- If `OPENOX_IMAGE_API_KEY` is empty or image generation fails and fallback is enabled, the server returns mock three-view sets.
- If `OPENOX_API_KEY` is empty, LLM mock mode is used automatically.

Check runtime config:

```bash
curl http://localhost:3000/api/llm/health
```

## Backgrounds

Put local background images here:

```text
server/assets/backgrounds/
```

Supported formats:

```text
.jpg
.jpeg
.png
.webp
```

If no background exists, `GET /api/backgrounds/random` returns a generated default background.

## Runtime Directories

The server creates these directories on startup:

```text
server/uploads/garments/
server/generated/three-views/
server/assets/backgrounds/
server/data/
```

`server/uploads/`, `server/generated/`, and `server/data/garment-sessions.json` are ignored by git.

## APIs

### POST `/api/garment/generate-three-view-sets`

`multipart/form-data`

```text
frontImage: image
backImage: image
```

Returns:

```json
{
  "sessionId": "string",
  "garmentAnalysis": {},
  "sets": [],
  "generationStatus": {}
}
```

### POST `/api/garment/prepare-video-prompts`

```json
{
  "sessionId": "string",
  "selectedSetId": "set_1"
}
```

Returns the selected three-view set, background, and three prompt cards:

- 服装细节展示
- 模特上身动态展示
- 穿前穿后差异展示

### GET `/api/backgrounds/random`

Returns a random local background image, or a fallback background if the directory is empty.

## Legacy APIs

1688 product analysis endpoints are still present for compatibility:

- `POST /api/extract-1688-product`
- `POST /api/analyze-product`
- `POST /api/generate-creative-assets`

They are no longer the primary iOS entry flow.
