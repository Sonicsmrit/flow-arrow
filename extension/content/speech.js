globalThis.FlowArrow = globalThis.FlowArrow || {};

// TTS output (Person C). Browser speechSynthesis ONLY, no server.
// Called guarded by Person A: if (globalThis.FlowArrow.speech && ...)
//   FlowArrow.speech.maybeSpeak(msg.step.instruction)
// Lang is auto-detected: Devanagari range means ne-NP, else en-US.
// Text-only fallback when speechSynthesis or a ne-NP voice is missing.
FlowArrow.speech = (() => {
  let enabled = true;
  const NE_RANGE = /[\u0900-\u097F]/;

  function synth() {
    try {
      return window.speechSynthesis || null;
    } catch {
      return null;
    }
  }

  function pickVoice(s, lang) {
    try {
      const voices = s.getVoices();
      if (!voices || voices.length === 0) return null;
      const prefix = lang === "ne" ? "ne" : "en";
      return (
        voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(prefix)) ||
        (lang === "ne"
          ? null
          : voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en")) || null)
      );
    } catch {
      return null;
    }
  }

  function speak(text, lang) {
    const s = synth();
    if (!s || !text) return false;
    const useLang = lang || (NE_RANGE.test(text) ? "ne" : "en");
    const voice = pickVoice(s, useLang);
    if (useLang === "ne" && !voice) return false; // text-only fallback for Nepali when no Nepali voice exists
    try {
      s.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else {
        u.lang = useLang === "ne" ? "ne-NP" : "en-US";
      }
      u.onerror = (e) => {
        if (e.error !== "canceled" && e.error !== "interrupted") {
          console.debug("[FlowArrow] TTS error:", e.error);
        }
      };
      s.speak(u);
      return true;
    } catch {
      return false;
    }
  }

  function maybeSpeak(text, lang) {
    if (!enabled) return false;
    return speak(text, lang);
  }

  function cancel() {
    const s = synth();
    if (!s) return;
    try {
      s.cancel();
    } catch {
      // ignore
    }
  }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) cancel();
  }

  function isEnabled() {
    return enabled;
  }

  // Warm the async voice cache in Chrome.
  try {
    const s = synth();
    if (s) {
      s.getVoices();
      s.onvoiceschanged = () => {
        try {
          s.getVoices();
        } catch {
          // ignore
        }
      };
    }
  } catch {
    // ignore
  }

  // Handle messages affecting speech
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg) return;
      if (msg.type === "FLOW_ENDED" || msg.type === "FLOW_ERROR") {
        cancel();
      } else if (msg.type === "FLOW_SPEAK_TOGGLE") {
        setEnabled(!!msg.speak);
      }
    });
  } catch {
    // ignore (not running as an extension content script)
  }

  return { speak, maybeSpeak, cancel, setEnabled, isEnabled };
})();
