globalThis.FlowArrow = globalThis.FlowArrow || {};
// Section 9 widget: launcher + goal box. Step 1 skeleton only.
// Person A owns this file. Talks to SW via FLOW_* messages only, never fetch().
(function () {
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

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

  function build(shadow) {
    // Launcher
    const launcher = el("button", "fa-launcher", "\u2794");
    launcher.setAttribute("aria-label", "Open Flow Arrow");
    launcher.addEventListener("click", () => {
      const card = shadow.querySelector(".fa-card");
      const hidden = !card || card.style.display === "none";
      render(shadow, hidden);
    });
    shadow.appendChild(launcher);

    // Card
    const card = el("div", "fa-card");
    card.style.display = "none";

    const langRow = el("div", "fa-langrow");
    const btnEn = el("button", "fa-lang", "EN");
    const btnNe = el("button", "fa-lang", "NE");
    btnEn.setAttribute("aria-pressed", getLang() === "en" ? "true" : "false");
    btnNe.setAttribute("aria-pressed", getLang() === "ne" ? "true" : "false");
    btnEn.addEventListener("click", () => {
      setLang("en");
      btnEn.setAttribute("aria-pressed", "true");
      btnNe.setAttribute("aria-pressed", "false");
    });
    btnNe.addEventListener("click", () => {
      setLang("ne");
      btnNe.setAttribute("aria-pressed", "true");
      btnEn.setAttribute("aria-pressed", "false");
    });
    langRow.appendChild(btnEn);
    langRow.appendChild(btnNe);
    card.appendChild(langRow);

    const box = el("textarea", "fa-goal");
    box.setAttribute("placeholder", "Type a goal, e.g. pay my credit card bill");
    card.appendChild(box);

    const row = el("div", "fa-row");
    const mic = el("button", "fa-iconbtn", "Mic");
    mic.setAttribute("aria-label", "Voice input");
    mic.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "FLOW_VOICE_TOGGLE" });
    });
    const speaker = el("button", "fa-iconbtn", "Spk");
    speaker.setAttribute("aria-label", "Toggle voice output");
    let speak = false;
    speaker.addEventListener("click", () => {
      speak = !speak;
      speaker.setAttribute("aria-pressed", speak ? "true" : "false");
      chrome.runtime.sendMessage({ type: "FLOW_SPEAK_TOGGLE", speak });
    });
    const close = el("button", "fa-iconbtn", "X");
    close.addEventListener("click", () => render(shadow, false));
    const send = el("button", "fa-send", "Send");
    send.addEventListener("click", () => {
      const goal = box.value.trim();
      if (!goal) return;
      chrome.runtime.sendMessage(
        { type: "FLOW_START", goal, lang: getLang(), speak },
        () => {
          if (chrome.runtime.lastError) {
            // SW not ready yet (Person B builds it). Keep the goal text.
            console.debug("[FlowArrow] FLOW_START no SW yet");
          }
        }
      );
    });
    row.appendChild(mic);
    row.appendChild(speaker);
    row.appendChild(close);
    row.appendChild(send);
    card.appendChild(row);
    shadow.appendChild(card);
  }

  function render(shadow, open) {
    const card = shadow.querySelector(".fa-card");
    const launcher = shadow.querySelector(".fa-launcher");
    if (!card || !launcher) return;
    card.style.display = open ? "block" : "none";
    launcher.textContent = open ? "\u2304" : "\u2794";
  }

  globalThis.FlowArrow.widget = { build, render, getLang };
})();
