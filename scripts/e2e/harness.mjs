// E2E harness: loads the real unpacked Flow Arrow extension into Playwright's
// Chromium (new headless mode supports extensions) and drives the demo bank.
// The Flow Arrow UI is in a CLOSED shadow root on <flow-arrow-root>, so it is
// driven with real mouse/keyboard input plus CDP reads, like a user would.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

export const EXT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../extension");
export const HERE = path.dirname(new URL(import.meta.url).pathname);
export const OUT = path.join(HERE, ".out"); // screenshots + throwaway profiles (gitignored)
export const LOGS = path.resolve(HERE, "../../server/logs");
export const REPO = path.resolve(HERE, "../..");
export const VW = 1440, VH = 900;

export function backendUrl() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, "config.local.json"), "utf8"));
    if (cfg.BACKEND_URL) return cfg.BACKEND_URL;
  } catch { /* default */ }
  return "http://localhost:8787";
}

export async function backendHealthy() {
  try {
    const r = await fetch(`${backendUrl()}/health`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// Launcher: 56x56 at right 20 / bottom 20 (content/styles.js).
export async function launch({ headless = true, zoom = 1 } = {}) {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(OUT, "profile-"));
  const ctx = await chromium.launchPersistentContext(dir, {
    channel: "chromium",
    headless,
    viewport: { width: Math.round(VW / zoom), height: Math.round(VH / zoom) },
    deviceScaleFactor: zoom,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent("serviceworker");
  // A fresh profile is a fresh install: the welcome tab (mic permission)
  // opens once. Close it so the test page stays the visible tab.
  const welcome = ctx.pages().find((p) => p.url().includes("welcome.html")) ||
    (await ctx.waitForEvent("page", { predicate: (p) => p.url().includes("welcome.html"), timeout: 3000 }).catch(() => null));
  if (welcome) await welcome.close();
  const swLogs = [];
  sw.on("console", (m) => swLogs.push(`${Date.now()} ${m.text()}`));
  const page = ctx.pages().find((p) => !p.url().includes("welcome.html")) || (await ctx.newPage());
  await page.bringToFront();
  const pageLogs = [];
  page.on("console", (m) => {
    const t = m.text();
    if (t.includes("[FlowArrow")) pageLogs.push(`${Date.now()} ${t}`);
  });
  page.on("pageerror", (e) => pageLogs.push(`${Date.now()} PAGEERROR ${e.message}`));
  return { ctx, sw, page, swLogs, pageLogs };
}

export async function allSessions(sw) {
  return sw.evaluate(() => chrome.storage.session.get(null));
}

export async function session(sw) {
  const all = await allSessions(sw);
  const keys = Object.keys(all).filter((k) => k.startsWith("session:"));
  return keys.length ? all[keys[0]] : null;
}

export async function waitFor(fn, { timeout = 30000, every = 150, label = "condition" } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, every));
  }
  throw new Error(`timeout waiting for ${label}; last=${JSON.stringify(last)}`);
}

// Flow Arrow UI inspection through CDP (it can see into the CLOSED shadow root).
export async function flowUi(page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
    const find = (n) => {
      if (n.nodeName === "FLOW-ARROW-ROOT") return n;
      for (const c of n.children || []) { const r = find(c); if (r) return r; }
      return null;
    };
    const host = find(root);
    if (!host || !host.shadowRoots || !host.shadowRoots[0]) return null;
    const sr = host.shadowRoots[0].nodeId;
    const q = async (sel) => (await cdp.send("DOM.querySelectorAll", { nodeId: sr, selector: sel })).nodeIds;
    const html = async (id) => (await cdp.send("DOM.getOuterHTML", { nodeId: id })).outerHTML;
    const box = async (id) => {
      const { model } = await cdp.send("DOM.getBoxModel", { nodeId: id });
      const [x1, y1, , , x3, y3] = model.border;
      return { x: x1, y: y1, w: x3 - x1, h: y3 - y1, cx: (x1 + x3) / 2, cy: (y1 + y3) / 2 };
    };
    const buttons = [];
    for (const id of await q("button")) {
      const h = await html(id);
      const label = h.replace(/<[^>]+>/g, "").trim() || (h.match(/^<button[^>]*aria-label="([^"]*)"/) || [])[1] || "";
      try { buttons.push({ label, ...(await box(id)) }); } catch { /* not rendered */ }
    }
    const card = (await q(".fa-card"))[0];
    const cardHtml = card ? await html(card) : "";
    const cardOpen = card ? !/display:\s*none/.test(cardHtml) : false;
    const pill = (await q(".fa-pill")).length > 0;
    const capIds = await q(".flow-arrow-caption:not(.flow-arrow-leaving)");
    let caption = "";
    if (capIds[0]) {
      try {
        const t = (await q(".flow-arrow-caption-text"))[0];
        if (t) caption = (await cdp.send("DOM.getOuterHTML", { nodeId: t })).outerHTML.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      } catch { /* fading */ }
    }
    const boxes = await q(".flow-arrow-box:not(.flow-arrow-complete):not(.flow-arrow-leaving)");
    let ring = null;
    if (boxes[0]) { try { ring = await box(boxes[0]); } catch { /* not laid out yet */ } }
    return { buttons, cardOpen, pill, caption, ring };
  } finally {
    await cdp.detach();
  }
}

export async function shadowBox(page, selector) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
    const find = (n) => {
      if (n.nodeName === "FLOW-ARROW-ROOT") return n;
      for (const c of n.children || []) { const r = find(c); if (r) return r; }
      return null;
    };
    const host = find(root);
    if (!host || !host.shadowRoots || !host.shadowRoots[0]) return null;
    const sr = host.shadowRoots[0].nodeId;
    const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: sr, selector });
    if (!nodeIds.length) return null;
    const { model } = await cdp.send("DOM.getBoxModel", { nodeId: nodeIds[0] });
    const [x1, y1, , , x3, y3] = model.border;
    return { x: x1, y: y1, w: x3 - x1, h: y3 - y1, cx: (x1 + x3) / 2, cy: (y1 + y3) / 2 };
  } finally {
    await cdp.detach();
  }
}

export async function clickShadowButton(page, label) {
  const ui = await flowUi(page);
  const b = ui && ui.buttons.find((b) => b.label === label && b.w > 0);
  if (!b) throw new Error(`Flow Arrow button "${label}" not found; have ${ui && ui.buttons.map((b) => b.label)}`);
  await page.mouse.click(b.cx, b.cy);
}

export async function clickLauncher(page) {
  await page.mouse.click(VW - 20 - 28, VH - 20 - 28);
}

export async function startGoal(page, goal, lang = "en") {
  await clickLauncher(page);
  await page.waitForTimeout(400);
  if (lang === "ne") await clickShadowButton(page, "NE");
  const area = await shadowBox(page, ".fa-goal");
  if (area) await page.mouse.click(area.cx, area.cy);
  await page.keyboard.type(goal);
  await clickShadowButton(page, "Send");
}

export function latestLogDirs(n = 1) {
  if (!fs.existsSync(LOGS)) return [];
  const dirs = fs.readdirSync(LOGS).filter((d) => /^\d{8}-/.test(d)).sort();
  return dirs.slice(-n).map((d) => path.join(LOGS, d));
}

export async function shot(page, name) {
  const p = path.join(OUT, "shots", `${name}.png`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  await page.screenshot({ path: p });
  return p;
}

export async function hubSetPopups(popups) {
  const res = await fetch("http://localhost:3000/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ popups }),
  });
  return res.json();
}

// Waits for the next state that needs the user, returns it.
export async function nextUserState(sw, afterTurn = 0, timeout = 90000) {
  return waitFor(async () => {
    const s = await session(sw);
    if (!s) return { kind: "ended" };
    if (s.status === "awaiting_action" && s.turn > afterTurn && s.currentStep) return { kind: "step", s };
    if (s.status === "error") return { kind: "error", s };
    return false;
  }, { timeout, label: "user-actionable state" });
}

// What a user would type into a field for this label.
export function textFor(label, step) {
  const pick = (l) => {
    l = l.toLowerCase();
    if (l.includes("password")) return "1234";
    if (l.includes("username") || l.includes("user name") || l.includes("user id")) return "eluu";
    if (l.includes("amount")) return "50";
    if (l.includes("reason")) return "Checkup";
    return null;
  };
  return pick(label) || pick(step.instruction) || "hello";
}

// Performs the current step like a user would. Returns a description.
export async function doStep(page, s, opts = {}) {
  const step = s.currentStep;
  if (step.action === "scroll") {
    await page.mouse.move(VW / 2, VH / 2);
    await page.mouse.wheel(0, step.scrollDirection === "up" ? -500 : 500);
    return "scrolled";
  }
  if (step.action === "info") {
    await clickShadowButton(page, "I did it");
    return "clicked I did it";
  }
  if (step.action === "show") {
    await clickShadowButton(page, "Got it");
    return `clicked Got it on #${step.elementId}`;
  }
  // Act where the ring is, like a user (ring = target rect + pad).
  const ui = await waitFor(async () => { const u = await flowUi(page); return u && u.ring && u.ring.w > 0 ? u : false; }, { timeout: 8000, label: "ring" }).catch(() => null);
  if (!ui) return `NO RING for #${step.elementId}`;
  let ring = ui.ring;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(150);
    const u = await flowUi(page);
    if (!u || !u.ring) break;
    const still = Math.abs(u.ring.cx - ring.cx) < 1 && Math.abs(u.ring.cy - ring.cy) < 1;
    ring = u.ring;
    if (still) break;
  }
  const cx = ring.cx, cy = ring.cy;
  const label = s.currentElementLabel || "";
  const isSelect = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest("select"), { x: cx, y: cy });
  if (isSelect) {
    const picked = await page.evaluate(({ x, y, instruction, label }) => {
      const sel = document.elementFromPoint(x, y)?.closest("select");
      if (!sel) return null;
      const opts = [...sel.options].filter((o) => o.value && !o.disabled);
      const words = (t) => t.toLowerCase().replace(/[^a-z0-9$.]+/g, " ").split(" ").filter((w) => w.length > 2);
      const own = new Set(words(label));
      const ins = new Set(words(instruction).filter((w) => !own.has(w)));
      let best = null, bestScore = 0;
      for (const o of opts) {
        const score = words(o.text).filter((w) => ins.has(w)).length;
        if (score > bestScore) { best = o; bestScore = score; }
      }
      const choice = best || opts.find((o) => o.value !== sel.value) || opts[0];
      if (!choice) return null;
      sel.focus();
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, choice.value);
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return choice.text;
    }, { x: cx, y: cy, instruction: step.instruction, label });
    return `pick "${picked}" in #${step.elementId} "${label}"`;
  }
  if (step.action === "click") {
    await page.mouse.click(cx, cy);
    return `click #${step.elementId} "${label}" at ${Math.round(cx)},${Math.round(cy)}`;
  }
  await page.mouse.click(cx, cy);
  await page.keyboard.press("Control+A");
  const text = opts.text || textFor(label, step);
  await page.keyboard.type(text, { delay: 20 });
  await page.keyboard.press("Tab");
  return `type "${text}" into #${step.elementId} "${label}"`;
}

// Follows Flow Arrow like a user until the session ends, errors, or maxTurns.
export async function follow(page, sw, { maxTurns = 30, afterTurn = 0, log = () => {}, onStep } = {}) {
  let turn = afterTurn;
  let sessionId = null;
  const steps = [];
  const t0 = Date.now();
  for (let i = 0; i < maxTurns; i++) {
    let st;
    try {
      st = await nextUserState(sw, turn, 90000);
    } catch (e) {
      return { end: "stuck", detail: e.message.slice(0, 160), steps, sessionId, ms: Date.now() - t0 };
    }
    if (st.kind === "ended") {
      return { end: "ended", steps, sessionId, ms: Date.now() - t0 };
    }
    if (st.kind !== "step") {
      const ui = await flowUi(page).catch(() => null);
      return { end: st.kind, detail: (ui && ui.caption) || "", steps, sessionId, ms: Date.now() - t0, session: st.s };
    }
    turn = st.s.turn;
    sessionId = st.s.sessionId;
    if (onStep) {
      const r = await onStep(st.s, steps.length);
      if (r === "stop") return { end: "stopped-by-scenario", steps, sessionId, ms: Date.now() - t0, session: st.s };
      if (r === "skip") continue;
    }
    await page.waitForTimeout(250);
    const what = await doStep(page, st.s);
    const step = st.s.currentStep;
    steps.push({ turn, action: step.action, elementId: step.elementId, instruction: step.instruction, what });
    log(`    t${turn} ${step.action} "${step.instruction}" -> ${what}`);
  }
  return { end: "max-steps", steps, sessionId, ms: Date.now() - t0 };
}

// The bank's persisted state (localStorage "himalbank:state"), read in page.
export async function appState(page, prefix = "himalbank:") {
  return page.evaluate((p) => {
    try { return JSON.parse(localStorage.getItem(p + "state")); } catch { return null; }
  }, prefix);
}

export function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
