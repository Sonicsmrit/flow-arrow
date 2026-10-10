globalThis.FlowArrow = globalThis.FlowArrow || {};

// CSS for the closed shadow root. Ported look, Flow Arrow names.
// Tunables live in content/config.js; literal values below match it.
globalThis.FlowArrow.styles = `
:host {
  all: initial;
  --fa-panel: #26235C;
  --fa-panel-2: #343078;
  --fa-ink: #F6F5FF;
  --fa-muted: #C8C5F0;
  --fa-beam: #FFD23F;
  --fa-beam-hover: #FFDB5C;
  --fa-beam-ink: #26235C;
  --fa-field-ink: #1D1B45;
  --fa-red: #E0475B;
  --fa-green: #1FA85A;
  --fa-font: "FlowArrow Atkinson Hyperlegible", "Noto Sans Devanagari", "Segoe UI", system-ui, -apple-system, sans-serif;
  --fa-ease: cubic-bezier(.3, .7, .2, 1);
}

* { box-sizing: border-box; font-family: var(--fa-font); -webkit-font-smoothing: antialiased; }
button { font: inherit; margin: 0; }
svg { display: block; }

/* Overlay: ring + dim, arrow, caption, info card, scroll arrow */

.flow-arrow-box {
  position: fixed;
  left: 0;
  top: 0;
  border: 4px solid var(--fa-beam);
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(20, 18, 56, 0);
  opacity: 0;
  pointer-events: none;
  z-index: 1;
  will-change: transform;
  transition: opacity .3s ease, box-shadow .35s ease, border-color .15s ease;
}
.flow-arrow-box.flow-arrow-on {
  opacity: 1;
  box-shadow: 0 0 0 9999px rgba(20, 18, 56, 0.52);
}
.flow-arrow-box::after {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  box-shadow: 0 0 0 8px rgba(255, 210, 63, .35);
  transition: box-shadow .15s ease;
}
.flow-arrow-box.flow-arrow-pulse::after { animation: flow-arrow-pulse 1.4s ease-in-out infinite; }
@keyframes flow-arrow-pulse {
  50% { box-shadow: 0 0 0 16px rgba(255, 210, 63, .12); }
}
.flow-arrow-box.flow-arrow-gliding {
  transition: transform 800ms var(--fa-ease), width 800ms var(--fa-ease),
    height 800ms var(--fa-ease), opacity .3s ease, box-shadow .35s ease;
}

/* Done: the ring turns green with a check, the dim lifts, then it all fades. */
.flow-arrow-box.flow-arrow-complete {
  border-color: var(--fa-green);
  box-shadow: 0 0 0 9999px rgba(20, 18, 56, 0);
}
.flow-arrow-box.flow-arrow-complete::after { animation: none; box-shadow: 0 0 0 8px rgba(31, 168, 90, .3); }
.flow-arrow-box.flow-arrow-leaving { opacity: 0; transition: opacity .15s ease, box-shadow .2s ease; }
.flow-arrow-check {
  position: absolute;
  top: -15px;
  right: -15px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--fa-green);
  box-shadow: 0 0 0 3px #fff, 0 4px 10px rgba(0, 0, 0, .25);
  display: grid;
  place-items: center;
  animation: flow-arrow-pop .3s cubic-bezier(.3, 1.6, .5, 1);
}
@keyframes flow-arrow-pop { from { transform: scale(0); } }

.flow-arrow-cursor {
  position: fixed;
  left: 0;
  top: 0;
  width: 34px;
  height: 40px;
  transform-origin: 0 0;
  opacity: 0;
  pointer-events: none;
  z-index: 3;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, .35));
  will-change: transform, opacity;
  transition: opacity .3s ease;
}
.flow-arrow-cursor.flow-arrow-on { opacity: 1; }
.flow-arrow-cursor.flow-arrow-near { opacity: 0.3; }
.flow-arrow-cursor.flow-arrow-gliding { transition: transform 800ms var(--fa-ease), opacity .3s ease; }

.flow-arrow-caption {
  position: fixed;
  left: 0;
  top: 0;
  max-width: 330px;
  background: var(--fa-beam);
  color: var(--fa-beam-ink);
  border-radius: 12px;
  padding: 11px 16px 13px;
  font-size: 19px;
  font-weight: 700;
  line-height: 1.32;
  box-shadow: 0 8px 24px rgba(20, 18, 56, .28), 0 1px 2px rgba(20, 18, 56, .2);
  opacity: 0;
  pointer-events: none;
  z-index: 2;
  transition: opacity .3s ease;
}
.flow-arrow-caption.flow-arrow-on { opacity: 1; }
.flow-arrow-caption.flow-arrow-leaving { opacity: 0; transition: opacity .15s ease; }
.flow-arrow-caption.flow-arrow-has-btn { pointer-events: auto; }
.flow-arrow-caption-text { display: block; overflow-wrap: anywhere; }
.flow-arrow-eyebrow {
  display: block;
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
  letter-spacing: .09em;
  text-transform: uppercase;
  opacity: .72;
  margin-bottom: 3px;
}
.flow-arrow-caption .flow-arrow-btn {
  display: block;
  width: 100%;
  margin-top: 12px;
  background: var(--fa-beam-ink);
  border-color: var(--fa-beam-ink);
  color: var(--fa-ink);
}
.flow-arrow-caption .flow-arrow-btn:hover { background: var(--fa-panel-2); border-color: var(--fa-panel-2); }
.flow-arrow-caption .flow-arrow-btn:focus-visible { outline: 3px solid var(--fa-beam-ink); outline-offset: 2px; }

.flow-arrow-card {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(400px, calc(100vw - 32px));
  background: var(--fa-panel);
  color: var(--fa-ink);
  border-radius: 16px;
  padding: 20px 22px 22px;
  font-size: 19px;
  font-weight: 700;
  line-height: 1.38;
  pointer-events: auto;
  z-index: 3;
  box-shadow: 0 20px 60px rgba(20, 18, 56, .45), 0 2px 8px rgba(20, 18, 56, .25);
  animation: flow-arrow-card-in .25s ease-out;
}
.flow-arrow-card .flow-arrow-eyebrow { color: var(--fa-beam); opacity: 1; margin-bottom: 6px; }
.flow-arrow-card .flow-arrow-btn { display: block; width: 100%; margin-top: 18px; }
@keyframes flow-arrow-card-in { from { opacity: 0; transform: translate(-50%, calc(-50% + 10px)); } }

.flow-arrow-edge {
  position: fixed;
  left: 50%;
  width: 64px;
  height: 64px;
  margin-left: -32px;
  border-radius: 50%;
  background: var(--fa-beam);
  display: grid;
  place-items: center;
  pointer-events: none;
  z-index: 2;
  box-shadow: 0 8px 24px rgba(20, 18, 56, .3), 0 0 0 6px rgba(255, 210, 63, .3);
  animation: flow-arrow-bob 1.1s ease-in-out infinite;
}
.flow-arrow-edge.flow-arrow-down { bottom: 28px; }
.flow-arrow-edge.flow-arrow-up { top: 28px; animation-direction: reverse; }
@keyframes flow-arrow-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(8px); } }

/* Widget: dock + launcher + panel / pill */

.flow-arrow-dock {
  position: fixed;
  right: 24px;
  bottom: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  z-index: 5;
}
.flow-arrow-dock.flow-arrow-left { right: auto; left: 24px; align-items: flex-start; }

.flow-arrow-launcher {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--fa-panel);
  border: none;
  padding: 0;
  display: grid;
  place-items: center;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 0 0 2px rgba(246, 245, 255, .9), 0 6px 18px rgba(20, 18, 56, .4);
  transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
}
.flow-arrow-launcher:hover { background: var(--fa-panel-2); transform: translateY(-1px); }
.flow-arrow-launcher:active { transform: translateY(0); }
.flow-arrow-launcher:focus-visible { outline: 3px solid var(--fa-beam); outline-offset: 4px; }
.flow-arrow-launcher[hidden] { display: none; }
.flow-arrow-launcher .flow-arrow-logo { transform: translate(2px, 1px); }

.flow-arrow-panel {
  width: 340px;
  background: var(--fa-panel);
  color: var(--fa-ink);
  border-radius: 16px;
  padding: 16px;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: 16px;
  line-height: 1.4;
  box-shadow: 0 16px 48px rgba(20, 18, 56, .38), 0 2px 6px rgba(20, 18, 56, .22);
  animation: flow-arrow-rise .2s ease-out;
}
.flow-arrow-panel[hidden] { display: none; }
@keyframes flow-arrow-rise { from { opacity: 0; transform: translateY(8px); } }

.flow-arrow-head { display: flex; align-items: center; gap: 9px; min-height: 24px; }
.flow-arrow-title { font-size: 18px; font-weight: 700; letter-spacing: -.005em; }

.flow-arrow-langrow { display: flex; gap: 8px; }
.flow-arrow-lang {
  flex: 1;
  min-height: 38px;
  border-radius: 10px;
  border: 2px solid rgba(200, 197, 240, .45);
  background: transparent;
  color: var(--fa-ink);
  font-weight: 700;
  cursor: pointer;
}
.flow-arrow-lang[aria-pressed="true"] { background: var(--fa-beam); border-color: var(--fa-beam); color: var(--fa-beam-ink); }

.flow-arrow-field { position: relative; }
.flow-arrow-panel textarea {
  display: block;
  width: 100%;
  min-height: 108px;
  resize: none;
  margin: 0;
  border: 2px solid transparent;
  border-radius: 12px;
  padding: 11px 13px 50px;
  background: #fff;
  color: var(--fa-field-ink);
  font-family: var(--fa-font);
  font-size: 17px;
  line-height: 1.4;
  transition: border-color .15s ease;
}
.flow-arrow-panel textarea::placeholder { color: #6E6A9E; opacity: 1; }
.flow-arrow-panel textarea:focus { outline: none; border-color: var(--fa-beam); }
.flow-arrow-panel textarea[readonly] { cursor: default; }

.flow-arrow-mic {
  position: absolute;
  right: 9px;
  bottom: 9px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: var(--fa-panel);
  color: var(--fa-ink);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background .15s ease;
}
.flow-arrow-mic:hover { background: var(--fa-panel-2); }
.flow-arrow-mic:focus-visible { outline: 3px solid var(--fa-panel); outline-offset: 2px; }
.flow-arrow-mic.flow-arrow-live { background: var(--fa-red); animation: flow-arrow-mic-pulse 1.3s ease-out infinite; }
.flow-arrow-mic.flow-arrow-live:hover { background: #C93A4D; }
.flow-arrow-mic.flow-arrow-busy { cursor: default; }
.flow-arrow-mic.flow-arrow-busy:hover { background: var(--fa-panel); }
@keyframes flow-arrow-mic-pulse {
  0% { box-shadow: 0 0 0 0 rgba(224, 71, 91, .55); }
  100% { box-shadow: 0 0 0 12px rgba(224, 71, 91, 0); }
}

.flow-arrow-note { margin-top: -4px; font-size: 15px; color: var(--fa-muted); }
.flow-arrow-note.flow-arrow-bad { color: #FFB8C2; }

.flow-arrow-row { display: flex; gap: 10px; }
.flow-arrow-btn {
  flex: 1;
  min-height: 44px;
  border-radius: 12px;
  padding: 9px 14px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  cursor: pointer;
  border: 2px solid rgba(200, 197, 240, .45);
  background: transparent;
  color: var(--fa-ink);
  transition: background .15s ease, border-color .15s ease;
}
.flow-arrow-btn:hover { background: rgba(246, 245, 255, .08); border-color: rgba(200, 197, 240, .7); }
.flow-arrow-btn:focus-visible { outline: 3px solid var(--fa-beam); outline-offset: 2px; }
.flow-arrow-btn.flow-arrow-primary { background: var(--fa-beam); border-color: var(--fa-beam); color: var(--fa-beam-ink); }
.flow-arrow-btn.flow-arrow-primary:hover { background: var(--fa-beam-hover); border-color: var(--fa-beam-hover); }

.flow-arrow-speakrow { display: flex; gap: 8px; align-items: center; }
.flow-arrow-speak {
  flex: 1;
  min-height: 38px;
  border-radius: 10px;
  border: 2px solid rgba(200, 197, 240, .45);
  background: transparent;
  color: var(--fa-ink);
  font-weight: 700;
  cursor: pointer;
}
.flow-arrow-speak[aria-pressed="true"] { background: var(--fa-beam); border-color: var(--fa-beam); color: var(--fa-beam-ink); }

.flow-arrow-msg { font-size: 17px; }
.flow-arrow-msg strong { color: var(--fa-beam); font-weight: 700; }

/* thinking + guiding: a compact pill that stays the same size between turns */
.flow-arrow-panel[data-state="thinking"],
.flow-arrow-panel[data-state="guiding"] {
  width: 320px;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 10px 10px 10px 12px;
}
.flow-arrow-badge {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--fa-panel-2);
  display: grid;
  place-items: center;
}
.flow-arrow-badge .flow-arrow-logo { transform: translate(1.5px, .5px); }
.flow-arrow-pill-text { flex: 1; min-width: 0; }
.flow-arrow-pill-eyebrow {
  display: block;
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--fa-muted);
}
.flow-arrow-pill-goal {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.flow-arrow-btn.flow-arrow-small { flex: none; min-height: 38px; padding: 6px 14px; font-size: 15px; border-radius: 10px; }

.flow-arrow-spin {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 3px solid rgba(255, 210, 63, .22);
  border-top-color: var(--fa-beam);
  animation: flow-arrow-rot .8s linear infinite;
}
.flow-arrow-mic .flow-arrow-spin { width: 18px; height: 18px; border-width: 2.5px; border-color: rgba(246, 245, 255, .25); border-top-color: var(--fa-ink); }
@keyframes flow-arrow-rot { to { transform: rotate(360deg); } }

.flow-arrow-dots::after {
  content: "";
  display: inline-block;
  width: 1.2em;
  text-align: left;
  animation: flow-arrow-dots 1.2s steps(4, end) infinite;
}
@keyframes flow-arrow-dots {
  0% { content: ""; } 25% { content: "."; } 50% { content: ".."; } 75%, 100% { content: "..."; }
}

/* done: a yellow card with a check */
.flow-arrow-panel[data-state="done"] {
  background: var(--fa-beam);
  color: var(--fa-beam-ink);
  align-items: center;
  text-align: center;
  gap: 6px;
  padding: 20px 20px 22px;
}
.flow-arrow-win-mark {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--fa-panel);
  display: grid;
  place-items: center;
  margin-bottom: 6px;
  animation: flow-arrow-pop .5s cubic-bezier(.3, 1.6, .5, 1);
}
.flow-arrow-big { font-size: 22px; font-weight: 700; line-height: 1.25; }
.flow-arrow-panel[data-state="done"] .flow-arrow-msg { font-size: 17px; font-weight: 700; opacity: .85; overflow-wrap: anywhere; }

/* error: the message next to a small alert mark */
.flow-arrow-alert { display: flex; gap: 12px; align-items: flex-start; }
.flow-arrow-alert-mark {
  flex: none;
  width: 28px;
  height: 28px;
  margin-top: 1px;
  border-radius: 50%;
  background: var(--fa-red);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 17px;
  font-weight: 700;
  line-height: 1;
}

@media (prefers-reduced-motion: reduce) {
  .flow-arrow-box::after, .flow-arrow-edge, .flow-arrow-dots::after, .flow-arrow-spin, .flow-arrow-mic.flow-arrow-live,
  .flow-arrow-panel, .flow-arrow-card, .flow-arrow-check, .flow-arrow-win-mark { animation: none !important; }
  .flow-arrow-dots::after { content: "..."; }
}

.flow-arrow-debug-tag {
  position: fixed;
  background: #111827;
  color: #fff;
  font-size: 11px;
  font-weight: bold;
  padding: 1px 4px;
  border-radius: 3px;
  pointer-events: none;
  z-index: 1;
}

.flow-arrow-debug-box {
  position: fixed;
  border: 2px solid #ef4444;
  pointer-events: none;
  z-index: 1;
}
`;
