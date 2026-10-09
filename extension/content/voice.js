globalThis.FlowArrow = globalThis.FlowArrow || {};

// Push-to-talk glue (section 12). Recording lives in the offscreen document,
// driven by sw/voice.js (Person B); this file only opens the goal box and
// relays mic state to the widget. Person A owns this file.
globalThis.FlowArrow.voice = {
  // Mic button or Alt+X (FLOW_TOGGLE_VOICE from the SW).
  toggle() {
    const shadow = globalThis.FlowArrow._shadow;
    if (shadow) globalThis.FlowArrow.widget.render(shadow, true);
    try {
      chrome.runtime.sendMessage({ type: "FLOW_VOICE_TOGGLE" });
    } catch {
      // SW not ready, ignore
    }
  },

  // FLOW_VOICE_STATE { state, text?, error? } from the SW.
  onState(message) {
    const shadow = globalThis.FlowArrow._shadow;
    if (!shadow) return;
    const mic = shadow.querySelector(".fa-iconbtn");
    if (mic) {
      if (message.state === "recording") {
        mic.textContent = "Rec";
        mic.setAttribute("aria-pressed", "true");
      } else if (message.state === "transcribing") {
        mic.textContent = "...";
      } else {
        mic.textContent = "Mic";
        mic.removeAttribute("aria-pressed");
      }
    }
    // Auto-send: the SW fills the goal box via widget.setVoice in the full
    // build; here the text arrives on the next FLOW_VOICE_STATE idle.
    if (message.state === "idle" && message.text) {
      const box = shadow.querySelector(".fa-goal");
      if (box) {
        box.value = message.text;
        const send = shadow.querySelector(".fa-send");
        if (send) send.click();
      }
    }
  },
};
