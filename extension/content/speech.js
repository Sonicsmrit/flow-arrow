globalThis.FlowArrow = globalThis.FlowArrow || {};

// TTS output: ElevenLabs API first (Nepali-quality voices), browser
// speechSynthesis fallback. Called guarded by Person A:
//   if (globalThis.FlowArrow.speech && ...)
//     FlowArrow.speech.maybeSpeak(msg.step.instruction)
FlowArrow.speech = (() => {
  let enabled = true;
  const NE_RANGE = new RegExp("[\\u0900-\\u097F]");
  let audioContext = null;
  let currentAudio = null;
  let baseUrl = null; // backend URL, resolved like sw/api.js (config.local.json, else localhost)

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
    baseUrl = "http://localhost:8787";
    return baseUrl;
  }

  function getAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
  }

  function stopAudio() {
    if (currentAudio) {
      try { currentAudio.stop(); } catch { /* ignore */ }
      currentAudio = null;
    }
  }

  function playAudio(base64Mp3) {
    return new Promise((resolve, reject) => {
      try {
        const binary = atob(base64Mp3);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const ctx = getAudioContext();
        ctx.decodeAudioData(bytes.buffer, (buffer) => {
          stopAudio();
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          currentAudio = source;
          source.onended = () => { currentAudio = null; resolve(true); };
          source.start(0);
        }, reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  async function speakWithElevenLabs(text, lang) {
    const url = await getBaseUrl();
    const res = await fetch(`${url}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.audio) throw new Error("No audio in response");
    await playAudio(data.audio);
    return true;
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

  function speakWithBrowser(text, lang) {
    const s = window.speechSynthesis;
    if (!s || !text) return Promise.resolve(false);
    const useLang = lang || (NE_RANGE.test(text) ? "ne" : "en");
    const voice = pickVoice(s, useLang);
    if (useLang === "ne" && !voice) return Promise.resolve(false); // text-only fallback for Nepali when no Nepali voice exists
    try {
      s.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else {
        u.lang = useLang === "ne" ? "ne-NP" : "en-US";
      }
      return new Promise((resolve) => {
        u.onend = () => resolve(true);
        u.onerror = (e) => {
          if (e.error !== "canceled" && e.error !== "interrupted") {
            console.debug("[FlowArrow] TTS error:", e.error);
          }
          resolve(false);
        };
        s.speak(u);
      });
    } catch {
      return Promise.resolve(false);
    }
  }

  async function speak(text, lang) {
    if (!text) return false;
    try {
      await speakWithElevenLabs(text, lang);
      return true;
    } catch (e) {
      console.warn("[FlowArrow] ElevenLabs failed, falling back to browser TTS");
      return speakWithBrowser(text, lang);
    }
  }

  function maybeSpeak(text, lang) {
    if (!enabled) return Promise.resolve(false);
    return speak(text, lang);
  }

  function cancel() {
    stopAudio();
    try {
      window.speechSynthesis.cancel();
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
    const s = window.speechSynthesis;
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

  // Handle messages affecting speech (mute on session end/error, speaker toggle).
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
