import type http from "node:http";
import type { Lang } from "./schema.ts";

// POST /transcribe (ARCHITECTURE 6.2): raw audio bytes (audio/webm) in,
// { ok, text, lang, latencyMs } out. Forwards to the local Nepali Whisper
// container. Audio is never written to disk.

const WHISPER_URL = process.env.WHISPER_URL || "http://localhost:8790";
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 15_000; // Nepali model is larger than the English base

export type TranscribeResponse =
  | { ok: true; text: string; lang: Lang; latencyMs: number }
  | { ok: false; error: string };

// Error strings the extension turns into friendly widget text.
export const VOICE_ERRORS = {
  down: "voice_helper_down",
  timeout: "voice_timeout",
  tooLarge: "audio_too_large",
  empty: "audio_empty",
} as const;

function detectLang(text: string): Lang {
  return /[\u0900-\u097F]/.test(text) ? "ne" : "en";
}

async function readAudio(req: http.IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_AUDIO_BYTES) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function transcribe(audio: Buffer): Promise<TranscribeResponse> {
  const start = Date.now();

  // 1. Try local Whisper container if available
  try {
    const res = await fetch(`${WHISPER_URL}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "audio/webm" },
      body: new Uint8Array(audio),
      signal: AbortSignal.timeout(3000), // Fast check for local whisper
    });
    if (res.ok) {
      const body = (await res.json()) as { text?: string };
      const text = (body.text || "").trim();
      return { ok: true, text, lang: detectLang(text), latencyMs: Date.now() - start };
    }
  } catch {
    // Whisper unreachable, fall back to Google GenAI audio transcription
  }

  // 2. Multimodal cloud STT fallback using the configured GEMMA_API_KEY
  const apiKey = process.env.GEMMA_API_KEY || process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "audio/webm", data: audio.toString("base64") } },
              {
                text: "Transcribe the spoken audio verbatim in its native language (English or Nepali). Output ONLY the transcribed words with no formatting, markdown, quotes, or conversational commentary.",
              },
            ],
          },
        ],
        config: {
          abortSignal: timeout,
          temperature: 0,
        },
      });

      const text = (response.text || "").trim();
      return { ok: true, text, lang: detectLang(text), latencyMs: Date.now() - start };
    } catch (err) {
      console.error("[transcribe] GenAI fallback error:", err);
    }
  }

  return { ok: false, error: VOICE_ERRORS.down };
}

export async function handleTranscribe(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const send = (status: number, body: TranscribeResponse) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const audio = await readAudio(req);
  if (!audio) {
    req.resume();
    return send(413, { ok: false, error: VOICE_ERRORS.tooLarge });
  }
  if (audio.length === 0) return send(400, { ok: false, error: VOICE_ERRORS.empty });
  const result = await transcribe(audio);
  if (result.ok) console.log(`transcribe ${result.latencyMs}ms [${result.lang}] "${result.text}"`);
  else console.log(`transcribe ERROR ${result.error}`);
  send(200, result);
}

// One line for the startup banner: is the Whisper container reachable?
export async function whisperStatus(): Promise<string> {
  try {
    const r = await fetch(`${WHISPER_URL}/health`, { signal: AbortSignal.timeout(1500) });
    const h = (await r.json()) as { model?: string };
    return `whisper ${h.model || "?"} at ${WHISPER_URL}`;
  } catch {
    return `whisper NOT reachable at ${WHISPER_URL} (voice input off; cd server && docker compose up -d whisper)`;
  }
}
