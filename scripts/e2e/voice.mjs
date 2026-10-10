// node voice.mjs
// Voice pipe check: backend /transcribe with an empty body must answer
// audio_empty (proves the pipe without a microphone), and the local Whisper
// container must answer /health when it is running.
import { backendUrl } from "./harness.mjs";

let fail = 0;
const note = (ok, name, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " - " + detail : ""}`);
  if (!ok) fail++;
};

try {
  const r = await fetch(`${backendUrl()}/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "audio/webm" },
    body: new Uint8Array(0),
    signal: AbortSignal.timeout(8000),
  });
  const b = await r.json();
  note(b.error === "audio_empty", "transcribe-empty", JSON.stringify(b).slice(0, 120));
} catch (e) {
  note(false, "transcribe-empty", `backend unreachable: ${e.message.slice(0, 100)}`);
}

try {
  const r = await fetch("http://localhost:8790/health", { signal: AbortSignal.timeout(4000) });
  const b = await r.json();
  note(!!(b.model || b.ok), "whisper-health", JSON.stringify(b).slice(0, 120));
} catch (e) {
  note(false, "whisper-health", `whisper down (docker compose up -d whisper): ${e.message.slice(0, 100)}`);
}

process.exit(fail ? 1 : 0);
