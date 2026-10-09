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

    const style = document.createElement("style");
    style.textContent = globalThis.FlowArrow.styles || "";
    shadow.appendChild(style);

    globalThis.FlowArrow.widget.build(shadow);

    // Minimal inbound handlers so Person B messages never throw.
    // Full overlay/watcher wiring lands in later steps.
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || typeof msg.type !== "string") return;
      if (msg.type === "FLOW_THINKING") {
        if (DEBUG) console.debug("[FlowArrow] thinking", msg.turn);
        sendResponse({ ok: true });
      } else if (msg.type === "FLOW_ENDED" || msg.type === "FLOW_DONE") {
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
