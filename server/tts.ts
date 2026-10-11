import type http from "node:http";
import { elevenlabsTTS } from "./providers/elevenlabs.ts";

export type TTSResponse =
  | { ok: true; audio: string; quotaRemaining: number; cacheHit: boolean }
  | { ok: false; error: string };

export async function handleTTS(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method !== "POST") {
    return send(405, { ok: false, error: "Method not allowed" });
  }

  let body = "";
  for await (const chunk of req) body += chunk;
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return send(400, { ok: false, error: "Invalid JSON" });
  }

  const { text, lang } = parsed;
  if (!text || typeof text !== "string") {
    return send(400, { ok: false, error: "Missing or invalid text" });
  }
  if (text.length > 5000) {
    return send(400, { ok: false, error: "Text too long (max 5000 chars)" });
  }

  const reqLang = parsed.lang === "ne" ? "ne" : "en";

  try {
    const result = await elevenlabsTTS(text, lang);
    res.setHeader("X-Quota-Remaining", String(result.quotaRemaining));
    res.setHeader("X-Cache-Hit", String(result.cacheHit));
    return send(200, { ok: true, audio: result.audio, quotaRemaining: result.quotaRemaining, cacheHit: result.cacheHit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isQuota = /limit|quota/i.test(msg);
    const status = isQuota ? 429 : 502;
    return send(status, { ok: false, error: msg });
  }
}
