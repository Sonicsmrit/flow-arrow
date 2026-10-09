// POST /next-step to the Flow Arrow backend (ARCHITECTURE 6.2). The base URL
// comes from config.local.json (BACKEND_URL, set to whoever runs the backend -
// Person B via tunnel - and pinned in chat), defaulting to localhost:8787.
const DEFAULT_BASE_URL = "http://localhost:8787";
// Worst case on the server is a parse retry plus a validation retry (15 s
// timeout each), so leave headroom.
const TIMEOUT_MS = 30_000;

let baseUrl = null;

async function getBaseUrl() {
  if (baseUrl) return baseUrl;
  try {
    const res = await fetch(chrome.runtime.getURL("config.local.json"));
    const cfg = await res.json();
    if (cfg && typeof cfg.BACKEND_URL === "string" && cfg.BACKEND_URL) {
      baseUrl = cfg.BACKEND_URL.replace(/\/+$/, "");
      return baseUrl;
    }
  } catch {
    // No config file on fresh clones: localhost it is.
  }
  baseUrl = DEFAULT_BASE_URL;
  return baseUrl;
}

export async function requestNextStep(req) {
  const url = await getBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${url}/next-step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    return await res.json();
  } catch (err) {
    if (controller.signal.aborted) {
      return { ok: false, error: "Flow Arrow's helper server took too long to respond", retryable: true };
    }
    if (res) {
      console.error("[FlowArrow:sw] /next-step returned non-JSON", res.status, err);
      return { ok: false, error: `Flow Arrow's helper server had a problem (HTTP ${res.status})`, retryable: true };
    }
    return { ok: false, error: "Flow Arrow's helper server is not running", retryable: true };
  } finally {
    clearTimeout(timeout);
  }
}
