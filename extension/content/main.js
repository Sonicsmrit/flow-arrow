globalThis.FlowArrow = globalThis.FlowArrow || {};
// Section 3 wiring. MUST stay last in the manifest content_scripts list.
// Person A owns this file. Creates <flow-arrow-root> + closed shadow root.
(function () {
  const DEBUG = false;

  // Atkinson Hyperlegible for our UI. An @font-face inside a shadow root
  // does not load in Chrome, so faces are added to the document font set
  // under our own family name. Bytes come from the content script (not a
  // url() the page CSP could block); on failure the fallbacks apply.
  function loadFonts() {
    const FAMILY = "FlowArrow Atkinson Hyperlegible";
    for (const weight of ["400", "700"]) {
      try {
        fetch(chrome.runtime.getURL(`fonts/atkinson-hyperlegible-${weight}.woff2`))
          .then((r) => r.arrayBuffer())
          .then((buf) => new FontFace(FAMILY, buf, { weight, style: "normal" }).load())
          .then((face) => document.fonts.add(face))
          .catch((err) => console.debug("[FlowArrow] font not loaded:", weight, String(err)));
      } catch (err) {
        console.debug("[FlowArrow] font not loaded:", weight, String(err));
      }
    }
  }

  function mount() {
    if (document.querySelector("flow-arrow-root")) return;
    const host = document.createElement("flow-arrow-root");
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: "closed" });
    globalThis.FlowArrow._shadow = shadow;
    globalThis.FlowArrow.host = host;

    const style = document.createElement("style");
    style.textContent = globalThis.FlowArrow.styles || "";
    shadow.appendChild(style);

    globalThis.FlowArrow.widget.build(shadow);

    let lastScanResult = null;

    function sendMsg(message) {
      try {
        chrome.runtime.sendMessage(message, () => {
          if (chrome.runtime.lastError) return;
        });
      } catch {
        // SW not ready, ignore
      }
    }

    // Inbound handlers for Person B step loop (section 6.3).
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || typeof msg.type !== "string") return;
      if (msg.type === "FLOW_PREPARE_CAPTURE") {
        // Hide all UI so the model never sees it, scan, reply, stay hidden.
        const host = document.querySelector("flow-arrow-root");
        if (host) host.style.visibility = "hidden";
        requestAnimationFrame(() => requestAnimationFrame(() => {
          try {
            lastScanResult = globalThis.FlowArrow.scanner.scan();
            if (host) host.style.visibility = "";
            sendResponse({ ok: true, scanId: lastScanResult.scanId, page: lastScanResult.page, elements: lastScanResult.elements });
          } catch (err) {
            if (host) host.style.visibility = "";
            sendResponse({ ok: false, error: String(err) });
          }
        }));
        return true;
      } else if (msg.type === "FLOW_THINKING") {
        const host = document.querySelector("flow-arrow-root");
        if (host) host.style.visibility = "";
        if (DEBUG) console.debug("[FlowArrow] thinking", msg.turn);
        globalThis.FlowArrow.widget.setState("thinking", { goal: msg.goal });
        sendResponse({ ok: true });
      } else if (msg.type === "FLOW_STEP") {
        const host = document.querySelector("flow-arrow-root");
        if (host) host.style.visibility = "";
        try {
          const needsElement = msg.step.action === "click" || msg.step.action === "type" || msg.step.action === "show";
          const el = msg.step.elementId != null
            ? globalThis.FlowArrow.scanner.getElement(msg.step.elementId)
            : null;
          // The page moved on since the scan: the step no longer matches.
          const stale =
            !lastScanResult ||
            lastScanResult.page.url !== location.href ||
            (needsElement && (!el || !el.isConnected));
          if (stale) {
            sendResponse({ ok: false, reason: "element_missing" });
            return;
          }
          globalThis.FlowArrow.widget.setState("guiding");
          globalThis.FlowArrow.overlay.showStep(msg.step, el, msg.turn);
          if (globalThis.FlowArrow.speech && msg.step) {
            globalThis.FlowArrow.speech.maybeSpeak(msg.step.instruction);
          }
          // Arm the watcher: first outcome reports instantly, then settle,
          // then FLOW_READY with the NEW turn number (section 10).
          globalThis.FlowArrow.watcher.arm(msg.step, el, (outcome) => {
            if (outcome === "completed" || outcome === "confirmed") {
              globalThis.FlowArrow.overlay.complete();
            } else {
              globalThis.FlowArrow.overlay.clear();
            }
            try {
              chrome.runtime.sendMessage({ type: "FLOW_STEP_RESULT", turn: msg.turn, outcome });
            } catch {
              // SW gone, ignore
            }
            globalThis.FlowArrow.dom.waitForSettle().then(() => {
              try {
                chrome.runtime.sendMessage({ type: "FLOW_READY", turn: msg.turn + 1 });
              } catch {
                // SW gone, ignore
              }
            });
          });
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ ok: false, reason: "element_missing" });
        }
      } else if (msg.type === "FLOW_TOGGLE_VOICE") {
        globalThis.FlowArrow.voice.toggle();
        sendResponse({ ok: true });
      } else if (msg.type === "FLOW_VOICE_STATE") {
        globalThis.FlowArrow.voice.onState(msg);
        sendResponse({ ok: true });
      } else if (msg.type === "FLOW_ERROR") {
        const host = document.querySelector("flow-arrow-root");
        if (host) host.style.visibility = "";
        globalThis.FlowArrow.watcher.disarm();
        globalThis.FlowArrow.overlay.clear();
        globalThis.FlowArrow.widget.setState("error", { message: msg.message, retryable: msg.retryable });
        sendResponse({ ok: true });
      } else if (msg.type === "FLOW_DONE") {
        const host = document.querySelector("flow-arrow-root");
        if (host) host.style.visibility = "";
        globalThis.FlowArrow.watcher.disarm();
        globalThis.FlowArrow.overlay.clear();
        globalThis.FlowArrow.widget.setState("done", { message: msg.message });
        sendResponse({ ok: true });
      } else if (msg.type === "FLOW_ENDED") {
        const host = document.querySelector("flow-arrow-root");
        if (host) host.style.visibility = "";
        globalThis.FlowArrow.watcher.disarm();
        globalThis.FlowArrow.overlay.clear();
        if (globalThis.FlowArrow.widget.inSession()) globalThis.FlowArrow.widget.setState("idle");
        sendResponse({ ok: true });
      }
    });

    // FLOW_HELLO once the page is loaded and quiet, so the SW can resume a
    // session across page loads. The widget restores itself from the reply.
    async function hello() {
      try {
        if (document.readyState !== "complete") {
          await new Promise((r) => {
            window.addEventListener("load", r, { once: true });
            setTimeout(r, 4000);
          });
        }
        await globalThis.FlowArrow.dom.waitForSettle({ quietMs: 500, maxMs: 4000 });
      } catch {
        // settle helper missing, continue anyway
      }
      try {
        chrome.runtime.sendMessage({ type: "FLOW_HELLO", url: location.href }, (reply) => {
          if (chrome.runtime.lastError) return;
          const session = reply && reply.session;
          if (!session) return;
          globalThis.FlowArrow.widget.setState("thinking", { goal: session.goal });
        });
      } catch {
        // SW not installed yet, ignore
      }
    }
    hello();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
  loadFonts();
})();
