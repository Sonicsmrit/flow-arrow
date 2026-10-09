globalThis.FlowArrow = globalThis.FlowArrow || {};
// Section 3 wiring. MUST stay last in the manifest content_scripts list.
// Person A owns this file. Creates <flow-arrow-root> + closed shadow root.
(function () {
  const DEBUG = false;

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

    // Inbound handlers for Person B step loop (section 6.3).
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || typeof msg.type !== "string") return;
      if (msg.type === "FLOW_PREPARE_CAPTURE") {
        // Hide all UI so the model never sees it, scan, reply, stay hidden.
        const host = document.querySelector("flow-arrow-root");
        if (host) host.style.visibility = "hidden";
        requestAnimationFrame(() => requestAnimationFrame(() => {
          try {
            const result = globalThis.FlowArrow.scanner.scan();
            if (host) host.style.visibility = "";
            sendResponse({ ok: true, scanId: result.scanId, page: result.page, elements: result.elements });
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
        sendResponse({ ok: true });
      } else if (msg.type === "FLOW_STEP") {
        const host = document.querySelector("flow-arrow-root");
        if (host) host.style.visibility = "";
        try {
          const el = msg.step.elementId != null
            ? globalThis.FlowArrow.scanner.getElement(msg.step.elementId)
            : null;
          if (msg.step.elementId != null && !el) {
            sendResponse({ ok: false, reason: "element_missing" });
            return;
          }
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
      } else if (msg.type === "FLOW_ERROR") {
        const host = document.querySelector("flow-arrow-root");
        if (host) host.style.visibility = "";
        globalThis.FlowArrow.watcher.disarm();
        globalThis.FlowArrow.overlay.clear();
        sendResponse({ ok: true });
      } else if (msg.type === "FLOW_ENDED" || msg.type === "FLOW_DONE") {
        const host = document.querySelector("flow-arrow-root");
        if (host) host.style.visibility = "";
        globalThis.FlowArrow.watcher.disarm();
        globalThis.FlowArrow.overlay.clear();
        globalThis.FlowArrow.widget.render(shadow, false);
        sendResponse({ ok: true });
      }
    });

    // Announce presence so SW HELLO flow (Person B) can restore sessions.
    try {
      chrome.runtime.sendMessage({ type: "FLOW_HELLO", url: location.href });
    } catch {
      // SW not installed yet, ignore
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
