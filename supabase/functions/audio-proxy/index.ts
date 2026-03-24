// Supabase Edge Function: Audio Proxy
// Fetches audio from external URLs (Suno, Udio, direct links) server-side to bypass CORS.
//
// Deploy: supabase functions deploy audio-proxy --no-verify-jwt
// Required secrets:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   ALLOWED_ORIGINS (comma-separated) or APP_ORIGIN

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { applyRateLimit, getClientIp } from '../_shared/rate-limit.ts';
import {
  buildCorsHeaders,
  errorResponse,
  getOrCreateRequestId,
  isOriginAllowed,
  jsonResponse,
  normalizeString,
  parseAllowedOriginsFromEnv,
  safeLogInfo,
  safeLogWarn,
  withRequestIdHeader,
} from '../_shared/validation.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const REQUIRED_ENV_MISSING = !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY;

const supabase = REQUIRED_ENV_MISSING
  ? null
  : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
const FETCH_TIMEOUT_MS = 30_000;

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.webm', '.m4a', '.flac', '.aac'];
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^\[::1\]/,
];

async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  if (!supabase) return null;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

function isBlockedHost(hostname: string): boolean {
  return BLOCKED_HOST_PATTERNS.some((p) => p.test(hostname));
}

function isDirectAudioUrl(url: string): boolean {
  const pathname = new URL(url).pathname.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

/**
 * For Suno/Udio share pages, try to extract the actual audio URL from og:audio or og:video meta tags.
 */
async function resolveAudioUrl(pageUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(pageUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MusicForge/1.0 AudioProxy' },
    });

    if (!res.ok) return null;

    const html = await res.text();

    // Try og:audio first
    const ogAudio = html.match(/<meta\s+(?:property|name)="og:audio"\s+content="([^"]+)"/i);
    if (ogAudio?.[1]) return ogAudio[1];

    // Try og:video (some services use video tag for audio)
    const ogVideo = html.match(/<meta\s+(?:property|name)="og:video"\s+content="([^"]+)"/i);
    if (ogVideo?.[1]) return ogVideo[1];

    // Try twitter:player:stream
    const twitterStream = html.match(/<meta\s+(?:property|name)="twitter:player:stream"\s+content="([^"]+)"/i);
    if (twitterStream?.[1]) return twitterStream[1];

    // Try finding audio source in HTML
    const audioSrc = html.match(/<audio[^>]*\ssrc="([^"]+)"/i);
    if (audioSrc?.[1]) return audioSrc[1];

    const sourceSrc = html.match(/<source[^>]*\ssrc="([^"]+)"[^>]*type="audio/i);
    if (sourceSrc?.[1]) return sourceSrc[1];

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  const requestId = getOrCreateRequestId(req);
  const allowedOrigins = parseAllowedOriginsFromEnv();
  const corsHeaders = withRequestIdHeader(
    buildCorsHeaders(req, allowedOrigins, {
      exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After', 'X-Request-Id'],
    }),
    requestId,
  );

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed.', corsHeaders, requestId);
  }

  // Check origin
  if (!isOriginAllowed(req, allowedOrigins)) {
    safeLogWarn('audio-proxy.cors_rejected', { requestId });
    return errorResponse(403, 'Origin not allowed.', corsHeaders, requestId);
  }

  // Check env
  if (REQUIRED_ENV_MISSING) {
    return errorResponse(503, 'Service not configured.', corsHeaders, requestId);
  }

  // Authenticate
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    safeLogWarn('audio-proxy.missing_auth', { requestId });
    return errorResponse(401, 'Authentication required.', corsHeaders, requestId);
  }

  // Rate limit: 30 per user per hour
  const userLimit = applyRateLimit(`audio-proxy:user:${userId}`, 30, 3600);
  if (!userLimit.allowed) {
    return errorResponse(429, 'Too many import requests. Try again later.', { ...corsHeaders, ...userLimit.headers }, requestId);
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body.', corsHeaders, requestId);
  }

  const url = normalizeString(body.url as string);
  if (!url) {
    return errorResponse(400, 'URL is required.', corsHeaders, requestId);
  }

  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return errorResponse(400, 'Invalid URL format.', corsHeaders, requestId);
  }

  if (parsed.protocol !== 'https:') {
    return errorResponse(400, 'Only HTTPS URLs are supported.', corsHeaders, requestId);
  }

  if (isBlockedHost(parsed.hostname)) {
    return errorResponse(400, 'This host is not allowed.', corsHeaders, requestId);
  }

  safeLogInfo('audio-proxy.start', { requestId, url: parsed.hostname + parsed.pathname });

  // Determine the actual audio URL
  let audioUrl = url;

  if (!isDirectAudioUrl(url)) {
    // Try to resolve from share page HTML
    const resolved = await resolveAudioUrl(url);
    if (!resolved) {
      return errorResponse(
        422,
        'Could not extract audio from this URL. Try downloading the file first and uploading it directly.',
        corsHeaders,
        requestId,
      );
    }
    audioUrl = resolved;

    // Make relative URLs absolute
    if (audioUrl.startsWith('/')) {
      audioUrl = `${parsed.origin}${audioUrl}`;
    }
  }

  // Fetch the audio
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const audioRes = await fetch(audioUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MusicForge/1.0 AudioProxy' },
    });

    if (!audioRes.ok) {
      return errorResponse(502, `Audio source returned ${audioRes.status}.`, corsHeaders, requestId);
    }

    // Check content length
    const contentLength = audioRes.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_BYTES) {
      return errorResponse(413, 'Audio file is too large (max 50MB).', corsHeaders, requestId);
    }

    // Determine content type
    const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';

    // Stream the audio back
    safeLogInfo('audio-proxy.success', { requestId, contentType, audioUrl: new URL(audioUrl).hostname });

    return new Response(audioRes.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        ...(contentLength ? { 'Content-Length': contentLength } : {}),
        'X-Request-Id': requestId,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return errorResponse(504, 'Audio fetch timed out.', corsHeaders, requestId);
    }
    safeLogWarn('audio-proxy.fetch_error', { requestId, error: String(err) });
    return errorResponse(502, 'Failed to fetch audio from source.', corsHeaders, requestId);
  } finally {
    clearTimeout(timeout);
  }
});
