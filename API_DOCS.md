# MusicForge Public API (Foundation)

This doc covers the Phase 4 foundation API for external generation clients.

## Base URL

- Supabase Edge Function endpoint:
  - `https://<project-ref>.supabase.co/functions/v1/api-generate`
- Optional reverse-proxy alias:
  - `/api/generate`

## Authentication

Use a MusicForge API key in one of these headers:

- `x-api-key: <your_key>`
- `Authorization: Bearer <your_key>`

API keys are stored hashed server-side (`api_keys.key_hash`).

## Create API Key

Authenticated app users can create a key using Supabase RPC:

- Function: `create_api_key(p_label text default null)`
- Returns:
  - `key` (only returned once)
  - `id`
  - `prefix`

Example SQL (authenticated session):

```sql
select public.create_api_key('server-worker');
```

## Endpoint: `POST /api/generate`

### Request Body

```json
{
  "prompt": "Warm analog synthwave with punchy drums",
  "mode": "standard",
  "genre": "synthwave",
  "bpm": 112,
  "keySignature": "Am",
  "duration": 60
}
```

### Field Rules

- `prompt`: required, 2-1000 chars
- `mode`: `standard | variation | extend | remix`
- `genre`: optional (falls back to user style profile/default)
- `bpm`: optional, 40-240
- `keySignature`: optional, musical key format
- `duration`: optional, 5-300 seconds

### Success Response

```json
{
  "success": true,
  "generationId": "uuid",
  "status": "completed",
  "outputUrl": "https://...",
  "previewUrl": "https://...",
  "requestId": "..."
}
```

### Error Response

```json
{
  "ok": false,
  "error": "Invalid or inactive API key.",
  "details": {
    "requestId": "..."
  }
}
```

## Rate Limits (Foundation)

- Per API key: 60 requests / 10 minutes
- Per IP: 120 requests / 10 minutes
- Response headers include:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
  - `Retry-After`
  - `X-Request-Id`

## Notes

- Current endpoint executes generation server-side and stores rows in `ai_generations`.
- API key usage updates `api_keys.last_used_at`.
- For production partner integrations, place an API gateway in front of the function for durable global limits and custom SLAs.
