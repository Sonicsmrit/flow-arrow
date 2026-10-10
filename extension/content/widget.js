globalThis.FlowArrow = globalThis.FlowArrow || {};

// Launcher + panel. States: idle (launcher only), open (goal box),
// thinking + guiding (a compact pill), done, error. No chat transcript:
// the goal box is the only text input. Person A owns this file.
(function () {
  const DONE_COLLAPSE_MS = 3000;
  const VOICE_SEND_DELAY_MS = 300;

  let dockEl = null;
  let launcherEl = null;
  let panelEl = null;
  let state = "open";
  let goal = "";
  let draft = "";
  let doneTimer = 0;
  let sendTimer = 0;
  let voice = "off";
  let note = null;
  let speak = false;

  function getLang() {
    try {
      return localStorage.getItem("flowarrow-lang") === "ne" ? "ne" : "en";
    } catch {
      return "en";
    }
  }

  function setLang(v) {
    try {
      localStorage.setItem("flowarrow-lang", v);
    } catch {
      // ignore, private mode
    }
  }

  function t(ne, en) {
    return getLang() === "ne" ? ne : en;
  }

  function send(message) {
    try {
      chrome.runtime.sendMessage(message, () => {
        if (chrome.runtime.lastError) return;
      });
    } catch {
      // SW not ready, ignore
    }
    return Promise.resolve(null);
  }

  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function button(label, onClick, kind) {
    const b = el("button", kind ? `flow-arrow-btn ${kind}` : "flow-arrow-btn", label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function inSession() {
    return state === "thinking" || state === "guiding" || state === "error";
  }

  function stop() {
    send({ type: "FLOW_STOP" });
    if (globalThis.FlowArrow.watcher) globalThis.FlowArrow.watcher.disarm();
    if (globalThis.FlowArrow.overlay) globalThis.FlowArrow.overlay.clear();
    setState("idle");
  }

  function submitGoal(text) {
    const g = text.trim();
    if (!g) return;
    draft = "";
    note = null;
    setState("thinking", { goal: g });
    send({ type: "FLOW_START", goal: g, lang: getLang(), speak });
  }

  function header() {
    const head = el("div", "flow-arrow-head");
    head.append(globalThis.FlowArrow.icons.logo(18), el("div", "flow-arrow-title", "Flow Arrow"));
    return head;
  }

  function langRow() {
    const row = el("div", "flow-arrow-langrow");
    const btnEn = el("button", "flow-arrow-lang", "EN");
    const btnNe = el("button", "flow-arrow-lang", "NE");
    btnEn.type = "button";
    btnNe.type = "button";
    btnEn.setAttribute("aria-pressed", getLang() === "en" ? "true" : "false");
    btnNe.setAttribute("aria-pressed", getLang() === "ne" ? "true" : "false");
    btnEn.addEventListener("click", () => {
      setLang("en");
      btnEn.setAttribute("aria-pressed", "true");
      btnNe.setAttribute("aria-pressed", "false");
      render();
    });
    btnNe.addEventListener("click", () => {
      setLang("ne");
      btnNe.setAttribute("aria-pressed", "true");
      btnEn.setAttribute("aria-pressed", "false");
      render();
    });
    row.append(btnEn, btnNe);
    return row;
  }

  function speakRow() {
    const row = el("div", "flow-arrow-speakrow");
    const btn = el("button", "flow-arrow-speak", t("आवाज: बन्द", "Voice: off"));
    btn.type = "button";
    btn.setAttribute("aria-pressed", speak ? "true" : "false");
    if (speak) btn.textContent = t("आवाज: चालु", "Voice: on");
    btn.addEventListener("click", () => {
      speak = !speak;
      btn.setAttribute("aria-pressed", speak ? "true" : "false");
      btn.textContent = speak ? t("आवाज: चालु", "Voice: on") : t("आवाज: बन्द", "Voice: off");
      send({ type: "FLOW_SPEAK_TOGGLE", speak });
    });
    row.append(btn);
    return row;
  }

  function goalBox() {
    const field = el("div", "flow-arrow-field");
    const ta = el("textarea");
    ta.setAttribute("aria-label", t("तपाईं के गर्न चाहनुहुन्छ?", "What do you want to do?"));
    ta.placeholder =
      voice === "recording" ? t("सुन्दैछु... सक्न Alt+X वा माइक थिच्नुहोस्", "Listening... press Alt+X or the mic to finish")
      : voice === "transcribing" ? t("पाएँ, एक छिन...", "Got it, one moment...")
      : t("तपाईं के गर्न चाहनुहुन्छ?", "What do you want to do?");
    ta.readOnly = voice !== "off";
    ta.value = voice === "off" ? draft : "";
    ta.addEventListener("input", () => (draft = ta.value));
    // Never let page listeners see these keys (bubble phase), and never let
    // a focused page field keep the keystrokes either (see focus below).
    for (const type of ["keydown", "keyup", "keypress"]) {
      ta.addEventListener(type, (e) => e.stopPropagation());
    }
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (voice === "off") submitGoal(ta.value);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    });

    const mic = el("button", "flow-arrow-mic");
    mic.type = "button";
    if (voice === "recording") {
      mic.classList.add("flow-arrow-live");
      mic.setAttribute("aria-label", t("रेकर्डिङ रोक्नुहोस्", "Stop recording"));
      mic.title = t("रेकर्डिङ रोक्नुहोस् (Alt+X)", "Stop recording (Alt+X)");
      mic.append(globalThis.FlowArrow.icons.mic());
    } else if (voice === "transcribing") {
      mic.classList.add("flow-arrow-busy");
      mic.disabled = true;
      mic.setAttribute("aria-label", t("लेख्दै...", "Transcribing"));
      mic.append(el("span", "flow-arrow-spin"));
    } else {
      mic.setAttribute("aria-label", t("आफ्नो लक्ष्य भन्नुहोस्", "Speak your goal"));
      mic.title = t("आफ्नो लक्ष्य भन्नुहोस् (Alt+X)", "Speak your goal (Alt+X)");
      mic.append(globalThis.FlowArrow.icons.mic());
    }
    mic.addEventListener("click", () => globalThis.FlowArrow.voice.toggle());

    field.append(ta, mic);
    return { field, ta };
  }

  function close() {
    if (voice === "recording") globalThis.FlowArrow.voice.toggle();
    voice = "off";
    note = null;
    setState("idle");
  }

  function pill(eyebrow, busy) {
    const badge = el("div", "flow-arrow-badge");
    badge.append(busy ? el("span", "flow-arrow-spin") : globalThis.FlowArrow.icons.logo(18));
    const text = el("div", "flow-arrow-pill-text");
    text.append(el("span", busy ? "flow-arrow-pill-eyebrow flow-arrow-dots" : "flow-arrow-pill-eyebrow", eyebrow));
    text.append(el("span", "flow-arrow-pill-goal", goal));
    panelEl.append(badge, text, button(t("रोक्नुहोस्", "Stop"), stop, "flow-arrow-small"));
  }

  function render(extra) {
    const shadow = globalThis.FlowArrow._shadow;
    if (!shadow || !panelEl) return;
    panelEl.replaceChildren();
    panelEl.dataset.state = state;
    panelEl.hidden = state === "idle";
    if (launcherEl) {
      launcherEl.hidden = !(state === "idle" || state === "open");
      launcherEl.replaceChildren(state === "open" ? globalThis.FlowArrow.icons.chevronDown() : globalThis.FlowArrow.icons.logo(22));
      launcherEl.setAttribute("aria-label", state === "open" ? "Close Flow Arrow" : "Open Flow Arrow");
      launcherEl.setAttribute("aria-expanded", String(state === "open"));
    }
    if (state === "idle") return;

    switch (state) {
      case "open": {
        const { field, ta } = goalBox();
        panelEl.append(header(), langRow(), field);
        if (note) panelEl.append(el("div", note.bad ? "flow-arrow-note flow-arrow-bad" : "flow-arrow-note", note.text));
        panelEl.append(speakRow());
        const row = el("div", "flow-arrow-row");
        row.append(
          button(t("बन्द", "Close"), close),
          button(t("पठाउनुहोस्", "Send"), () => voice === "off" && submitGoal(ta.value), "flow-arrow-primary")
        );
        panelEl.append(row);
        if (voice === "off") {
          setTimeout(() => {
            if (!ta.isConnected) return;
            // Steal focus from any page field so keystrokes land only here.
            try {
              const ae = document.activeElement;
              if (ae && ae !== ta && !dockEl.contains(ae)) ae.blur();
            } catch {
              // ignore
            }
            ta.focus();
          }, 0);
        }
        break;
      }
      case "thinking":
        pill(t("हेर्दै", "Looking"), true);
        break;
      case "guiding":
        pill(t("सहयोग गर्दै", "Helping you"), false);
        break;
      case "done": {
        const mark = el("div", "flow-arrow-win-mark");
        mark.append(globalThis.FlowArrow.icons.check(26, "#FFD23F", 3.2));
        panelEl.append(mark, el("div", "flow-arrow-big", t("सफल भयो!", "You did it!")));
        if (extra && extra.message) panelEl.append(el("div", "flow-arrow-msg", extra.message));
        break;
      }
      case "error": {
        const alert = el("div", "flow-arrow-alert");
        alert.append(
          el("span", "flow-arrow-alert-mark", "!"),
          el("div", "flow-arrow-msg", (extra && extra.message) || t("केही गलत भयो।", "Something went wrong."))
        );
        const row = el("div", "flow-arrow-row");
        row.append(button(t("बन्द", "Close"), stop));
        if (extra && extra.retryable) {
          row.append(button(t("फेरि प्रयास", "Try again"), () => {
            setState("thinking");
            send({ type: "FLOW_RETRY" });
          }, "flow-arrow-primary"));
        }
        panelEl.append(header(), alert, row);
        break;
      }
    }
  }

  function setState(next, extra) {
    clearTimeout(doneTimer);
    clearTimeout(sendTimer);
    if (extra && extra.goal !== undefined) goal = extra.goal;
    if (next !== "open") voice = "off";
    state = next;
    if (next === "idle" || next === "open") avoid(null);
    render(extra);
    if (next === "done") doneTimer = setTimeout(() => setState("idle"), DONE_COLLAPSE_MS);
  }

  function setVoice(msg) {
    if (msg.state === "recording" || msg.state === "transcribing") {
      if (state !== "open") setState("open");
      voice = msg.state;
      note = null;
      render();
      return;
    }
    const wasActive = voice !== "off";
    voice = "off";
    if (msg.state === "error") {
      if (state !== "open") setState("open");
      note = { text: msg.error || t("आवाजमा समस्या भयो। फेरि प्रयास गर्नुहोस् वा लेख्नुहोस्।", "Voice input had a problem. Try again or type instead."), bad: true };
      render();
      return;
    }
    if (state !== "open") return;
    const text = (msg.text || "").trim();
    if (!wasActive) return render();
    if (!text) {
      note = { text: t("केही सुनिएन, फेरि प्रयास गर्नुहोस्", "I couldn't hear anything, try again"), bad: true };
      return render();
    }
    draft = text;
    note = null;
    render();
    sendTimer = setTimeout(() => {
      if (state === "open" && voice === "off") submitGoal(draft);
    }, VOICE_SEND_DELAY_MS);
  }

  function rectsOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  // The widget must never cover the current target: if it would, move the
  // dock to the bottom-left corner (and back once the target is clear).
  function avoid(targetRect) {
    if (!dockEl) return;
    const isLeft = dockEl.classList.contains("flow-arrow-left");
    if (!targetRect) {
      if (isLeft) dockEl.classList.remove("flow-arrow-left");
      return;
    }
    const pad = 8;
    const tg = {
      left: targetRect.left - pad,
      top: targetRect.top - pad,
      right: targetRect.right + pad,
      bottom: targetRect.bottom + pad,
    };
    const r = dockEl.getBoundingClientRect();
    const rightSide = isLeft
      ? { left: window.innerWidth - 24 - r.width, right: window.innerWidth - 24, top: r.top, bottom: r.bottom }
      : r;
    const wantLeft = rectsOverlap(rightSide, tg);
    if (wantLeft !== isLeft) dockEl.classList.toggle("flow-arrow-left", wantLeft);
  }

  function rect() {
    if (!dockEl) return null;
    const r = dockEl.getBoundingClientRect();
    return r.width && r.height ? r : null;
  }

  // Where the arrow starts its first glide: the logo in the pill (or launcher).
  function anchor() {
    const shadow = globalThis.FlowArrow._shadow;
    if (!shadow) return null;
    const from = shadow.querySelector(".flow-arrow-badge") || (launcherEl && !launcherEl.hidden ? launcherEl : null);
    if (!from) return null;
    const r = from.getBoundingClientRect();
    return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }

  function build(shadow) {
    dockEl = el("div", "flow-arrow-dock");
    panelEl = el("div", "flow-arrow-panel");
    panelEl.hidden = true;
    panelEl.setAttribute("role", "dialog");
    panelEl.setAttribute("aria-label", "Flow Arrow");

    launcherEl = el("button", "flow-arrow-launcher");
    launcherEl.type = "button";
    launcherEl.title = "Flow Arrow (Alt+X to talk)";
    launcherEl.addEventListener("click", () => {
      if (state === "idle" || state === "done") setState("open");
      else if (state === "open") close();
    });

    dockEl.append(panelEl, launcherEl);
    shadow.appendChild(dockEl);

    // Keystrokes typed in the goal box must never reach the page: global
    // page shortcuts (and focused page fields) would react to them. Events
    // from inside the shadow tree still propagate to document, so stop them
    // at the dock. Our own handlers sit on inner elements and run first.
    for (const type of ["keydown", "keyup", "keypress"]) {
      dockEl.addEventListener(type, (e) => e.stopPropagation());
    }
    render();
  }

  // Compat: older main.js/voice.js call build(shadow) + render(shadow, open).
  function renderOpen(shadow, open) {
    if (!panelEl) build(shadow);
    if (open) {
      if (state === "idle" || state === "done") setState("open");
      else panelEl.hidden = false;
    } else {
      close();
    }
  }

  function openPanel() {
    if (state === "idle" || state === "done") setState("open");
    else if (panelEl) panelEl.hidden = false;
  }

  globalThis.FlowArrow.widget = {
    build,
    render: renderOpen,
    setState,
    setVoice,
    openPanel,
    avoid,
    rect,
    anchor,
    inSession,
    getLang,
    getState: () => state,
  };
})();
