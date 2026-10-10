globalThis.FlowArrow = globalThis.FlowArrow || {};

// Push-to-talk glue (section 12). Recording lives in the offscreen document,
// driven by sw/voice.js (Person B); this file only opens the goal box and
// relays state to the widget. Person A owns this file.
globalThis.FlowArrow.voice = {
  // Mic button or Alt+X (FLOW_TOGGLE_VOICE from the SW).
  // During a task it stops the task first and records a new goal.
  toggle() {
    const w = globalThis.FlowArrow.widget;
    if (w.inSession()) {
      try {
        chrome.runtime.sendMessage({ type: "FLOW_STOP" });
      } catch {
        // SW not ready, ignore
      }
      if (globalThis.FlowArrow.watcher) globalThis.FlowArrow.watcher.disarm();
      if (globalThis.FlowArrow.overlay) globalThis.FlowArrow.overlay.clear();
      w.setState("open");
    } else if (w.getState() !== "open") {
      w.setState("open");
    }
    try {
      chrome.runtime.sendMessage({ type: "FLOW_VOICE_TOGGLE" });
    } catch {
      // SW not ready, ignore
    }
  },

  // FLOW_VOICE_STATE { state, text?, error? } from the SW.
  onState(message) {
    globalThis.FlowArrow.widget.setVoice(message);
  },
};
