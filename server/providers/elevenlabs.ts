import { fetch } from "undici";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CACHE_FILE = join(process.cwd(), "server/tts_cache.json");
const MAX_CACHE_SIZE = 500;
const MONTHLY_CHAR_LIMIT = 10000;
const WARN_THRESHOLD = 8000;

let charUsed = 0;
let charUsedMonth = new Date().getMonth();
let cache = new Map<string, string>();

function loadCache() {
  try {
    const data = readFileSync(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(data);
    if (parsed.month === new Date().getMonth()) {
      charUsed = parsed.charUsed || 0;
      charUsedMonth = parsed.month;
      cache = new Map(Object.entries(parsed.cache || {}));
    }
  } catch { /* ignore */ }
}

function saveCache() {
  try {
    const data = { month: new Date().getMonth(), charUsed, cache: Object.fromEntries(cache) };
    writeFileSync(CACHE_FILE, JSON.stringify(data));
  } catch { /* ignore */ }
}

function hashKey(text: string, lang: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return `${hash}_${lang}`;
}

function checkMonthReset() {
  const currentMonth = new Date().getMonth();
  if (currentMonth !== charUsedMonth) {
    charUsed = 0;
    charUsedMonth = currentMonth;
    cache.clear();
    saveCache();
  }
}

loadCache();

export async function elevenlabsTTS(text: string, lang: string) {
  checkMonthReset();

  if (charUsed >= 10000) {
    throw new Error("Monthly character limit reached (10,000 chars)");
  }

  const cacheKey = `${text.length}_${lang}_${text.slice(0, 50)}`;
  if (cache.has(cacheKey)) {
    return { audio: cache.get(cacheKey)!, quotaRemaining: 10000 - charUsed, cacheHit: true };
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");

  const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel - multilingual
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      output_format: "mp3_44100_128",
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`ElevenLabs error ${response.status}: ${JSON.stringify(err)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const charCount = text.length;

  charUsed += charCount;
  if (cache.size >= 500) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(text.slice(0, 100), base64);
  saveCache();

  return { audio: base64, quotaRemaining: 10000 - charUsed, cacheHit: false };
}
