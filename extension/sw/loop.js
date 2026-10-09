// The step loop (ARCHITECTURE section 5):
// observing -> thinking -> awaiting_action -> settling -> observing ...
import { getSession, updateSession, replaceSession, clearSession } from "./session.js";
import { captureWithMarks } from "./marks.js";
import { requestNextStep } from "./api.js";

const MAX_TURNS = 40;
const HISTORY_SENT = 6;

function log(...args) {
  console.log("[FlowArrow:sw]", ...args);
}

// Only one loop iteration may be in flight per tab. Every runTurn takes a new
// token; an older run that wakes up from an await with a stale token stops.
const runTokens = new Map(); // tabId -> number

function newRunToken(tabId) {
  const token = (runTokens.get(tabId) || 0) + 1;
  runTokens.set(tabId, token);
  return token;
}

// Stops whatever run is in flight for this tab (its results are discarded).
export function cancelRuns(tabId) {
  newRunToken(tabId);
  waitingForActiveTab.delete(tabId);
}

// Tabs whose turn is paused because they are not the visible tab
// (captureVisibleTab would shoot whatever tab IS visible).
const waitingForActiveTab = new Set();

// Resolves to the content script's reply, or { ok:false, reason:"no_content_script" }
// when the page has no content script right now (it is loading or navigating).
function sendToTab(tabId, message) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, reason: "no_content_script", error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response);
      });
    } catch (err) {
      resolve({ ok: false, reason: "no_content_script", error: String(err) });
    }
  });
}

export async function startSession(tabId, goal, lang, speak) {
  cancelRuns(tabId);
  await replaceSession({
    sessionId: crypto.randomUUID(),
    tabId,
    goal,
    lang: lang === "ne" ? "ne" : "en",
    speak: !!speak,
    status: "observing",
    turn: 1,
    history: [],
    currentStep: null,
    currentElementLabel: null,
    startedAt: Date.now(),
    stepUrl: null,
    outcomeAt: null,
  });
  log(`t1 start [${lang === "ne" ? "ne" : "en"}] "${goal}" in tab ${tabId}`);
  await runTurn(tabId);
}

export async function stopSession(tabId) {
  cancelRuns(tabId);
  await clearSession(tabId);
  await sendToTab(tabId, { type: "FLOW_ENDED" });
}

// OBSERVING -> THINKING -> AWAITING_ACTION (or DONE / error) for the current turn.
export async function runTurn(tabId) {
  const token = newRunToken(tabId);
  waitingForActiveTab.delete(tabId);
  const isLive = () => runTokens.get(tabId) === token;

  let settleMs;
  const s0 = await updateSession(tabId, (s) => {
    if (!isLive()) return false;
    if (s.outcomeAt) settleMs = Date.now() - s.outcomeAt;
    s.outcomeAt = null;
    s.status = "observing";
  });
  if (!s0) return;
  const turn = s0.turn;

  if (turn > MAX_TURNS) {
    log(`t${turn} hit the ${MAX_TURNS}-turn cap`);
    cancelRuns(tabId);
    await clearSession(tabId);
    await sendToTab(tabId, {
      type: "FLOW_ERROR",
      message: "This is taking longer than expected. Let's start over.",
      retryable: false,
    });
    return;
  }

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return; // tab closed
  }
  if (!isLive()) return;
  if (!tab.active) {
    log(`t${turn} tab ${tabId} is in the background, resuming when it is shown`);
    waitingForActiveTab.add(tabId);
    return;
  }

  // 1. Scan (content hides ALL Flow Arrow UI first and keeps it hidden).
  const scanStart = performance.now();
  const scan = await sendToTab(tabId, { type: "FLOW_PREPARE_CAPTURE", turn });
  const scanMs = Math.round(performance.now() - scanStart);
  if (!isLive()) return;
  if (scan && scan.reason === "no_content_script") {
    log(`t${turn} no content script yet, waiting for FLOW_HELLO`);
    return;
  }
  if (!scan || !scan.page) {
    await fail(tabId, isLive, turn, "Lost contact with the page. Try reloading it.", true, scan && scan.error);
    return;
  }

  // 2. Screenshot + marks, while the UI is STILL hidden (capture-order rule).
  let shot;
  try {
    shot = await captureWithMarks(tab.windowId, scan.page, scan.elements);
  } catch (err) {
    if (!isLive()) return;
    await fail(tabId, isLive, turn, "Could not capture the screen. Try again.", true, err);
    return;
  }
  if (!isLive()) return;

  // 3. Un-hide the UI only now ("Looking...").
  const s1 = await updateSession(tabId, (s) => {
    if (!isLive() || s.turn !== turn) return false;
    s.status = "thinking";
  });
  if (!s1) return;
  await sendToTab(tabId, { type: "FLOW_THINKING", turn, goal: s1.goal, lang: s1.lang });
  if (!isLive()) return;

  const timings = { scanMs, captureMs: shot.captureMs, marksMs: shot.marksMs };
  if (settleMs !== undefined) timings.settleMs = settleMs;

  const response = await requestNextStep({
    sessionId: s1.sessionId,
    turn,
    goal: s1.goal,
    lang: s1.lang,
    page: scan.page,
    elements: scan.elements,
    history: s1.history.slice(-HISTORY_SENT),
    screenshot: shot.screenshot,
    timings,
  });
  if (!isLive()) return;

  if (!response.ok) {
    await fail(tabId, isLive, turn, response.error, response.retryable);
    return;
  }
  const now = await getSession(tabId);
  if (!now || now.turn !== turn) return;

  const step = response.step;
  log(`t${turn} ${step.action} #${step.elementId ?? "-"} "${step.instruction}" (${response.provider}, ${response.latencyMs} ms)`);

  // 4a. Goal reached with plain info: end at once. (A done "show" step still
  // points at the answer first: it ends when the user presses "Got it".)
  if (step.done && step.action === "info") {
    const current = await getSession(tabId);
    if (!isLive() || !current || current.turn !== turn) return;
    cancelRuns(tabId);
    await clearSession(tabId);
    await sendToTab(tabId, { type: "FLOW_DONE", message: step.instruction });
    return;
  }

  // 4b. Show the step and wait for the user.
  const target = scan.elements.find((el) => el.id === step.elementId);
  const s2 = await updateSession(tabId, (s) => {
    if (!isLive() || s.turn !== turn) return false;
    s.status = "awaiting_action";
    s.currentStep = step;
    s.currentElementLabel = target ? target.label : null;
    s.stepUrl = scan.page.url;
  });
  if (!s2) return;

  const reply = await sendToTab(tabId, { type: "FLOW_STEP", turn, step });
  if (!isLive()) return;
  if (reply && reply.ok === false && reply.reason === "element_missing") {
    // The page changed between the scan and now: re-plan from the new screen.
    log(`t${turn} target #${step.elementId} is gone, recording page_changed`);
    if (await recordOutcome(tabId, turn, "page_changed")) await proceedAfterSettle(tabId);
  }
  // no_content_script: the page is navigating; its FLOW_HELLO takes over.
}

async function fail(tabId, isLive, turn, message, retryable, detail) {
  if (detail) console.error("[FlowArrow:sw]", message, detail);
  const s = await updateSession(tabId, (s) => {
    if (!isLive() || s.turn !== turn) return false;
    s.status = "error";
  });
  if (!s) return;
  log(`t${turn} error: ${message} (retryable: ${retryable})`);
  await sendToTab(tabId, { type: "FLOW_ERROR", message, retryable: !!retryable });
}

// AWAITING_ACTION -> SETTLING. Returns true if the outcome was recorded
// (false for a stale turn or wrong status). "Got it" on a done "show" step
// ends the session instead (the answer was the goal).
export async function recordOutcome(tabId, turn, outcome) {
  const current = await getSession(tabId);
  const step = current && current.currentStep;
  if (
    step && step.done && step.action === "show" && outcome === "confirmed" &&
    current.status === "awaiting_action" && current.turn === turn
  ) {
    log(`t${turn} -> confirmed the answer, done`);
    cancelRuns(tabId);
    await clearSession(tabId);
    await sendToTab(tabId, { type: "FLOW_DONE", message: step.instruction });
    return false;
  }
  const s = await updateSession(tabId, (s) => {
    if (s.status !== "awaiting_action" || s.turn !== turn || !s.currentStep) return false;
    s.history.push({
      turn,
      action: s.currentStep.action,
      instruction: s.currentStep.instruction,
      elementLabel: s.currentElementLabel,
      outcome,
      url: s.stepUrl || "",
    });
    s.turn += 1;
    s.status = "settling";
    s.outcomeAt = Date.now();
    s.currentStep = null;
    s.currentElementLabel = null;
    s.stepUrl = null;
  });
  if (s) log(`t${turn} -> ${outcome}`);
  return !!s;
}

// SETTLING -> the next turn.
export async function proceedAfterSettle(tabId) {
  const s = await updateSession(tabId, (s) => {
    if (s.status !== "settling") return false;
    s.status = "observing";
  });
  if (!s) return;
  await runTurn(tabId);
}

// FLOW_HELLO: a page finished loading in this tab. Replies (via the returned
// summary) so the widget restores itself, then resumes the loop per section 5.
export async function handleHello(tabId) {
  const s = await getSession(tabId);
  const summary = s ? { goal: s.goal, lang: s.lang, speak: s.speak, status: s.status, turn: s.turn } : null;
  const resume = async () => {
    if (!s) return;
    switch (s.status) {
      case "settling":
        await proceedAfterSettle(tabId);
        break;
      case "awaiting_action":
        // User navigated without a watcher event (back button, typed URL, reload).
        if (await recordOutcome(tabId, s.turn, "page_changed")) await proceedAfterSettle(tabId);
        break;
      case "observing":
      case "thinking":
        await runTurn(tabId); // restart the current turn on the new page
        break;
      case "error":
        await runTurn(tabId); // a reload is a natural "try again"
        break;
    }
  };
  return { summary, resume };
}

export async function handleReady(tabId, turn) {
  const s = await getSession(tabId);
  if (!s || s.status !== "settling" || s.turn !== turn) return;
  await proceedAfterSettle(tabId);
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  if (!waitingForActiveTab.has(tabId)) return;
  waitingForActiveTab.delete(tabId);
  log(`tab ${tabId} is visible again, resuming`);
  runTurn(tabId).catch((err) => console.error("[FlowArrow:sw] runTurn (tab activated) failed", err));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  runTokens.delete(tabId);
  waitingForActiveTab.delete(tabId);
});
