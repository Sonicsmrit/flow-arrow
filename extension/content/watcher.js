globalThis.FlowArrow = globalThis.FlowArrow || {};

// DOM helpers shared by the watcher and main.js.
(function () {
  // Resolves once document.body has had no mutations (subtree, childList,
  // attributes) for `quietMs`, or after `maxMs` at the latest.
  function waitForSettle({ quietMs = 400, maxMs = 2500 } = {}) {
    return new Promise((resolve) => {
      const start = performance.now();
      const root = document.body || document.documentElement;
      let quietTimer = null;
      let maxTimer = null;
      let observer = null;

      function finish(quiet) {
        clearTimeout(quietTimer);
        clearTimeout(maxTimer);
        if (observer) observer.disconnect();
        resolve({ quiet, ms: Math.round(performance.now() - start) });
      }

      function restartQuiet() {
        clearTimeout(quietTimer);
        quietTimer = setTimeout(() => finish(true), quietMs);
      }

      observer = new MutationObserver(restartQuiet);
      observer.observe(root, { subtree: true, childList: true, attributes: true });
      maxTimer = setTimeout(() => finish(false), maxMs);
      restartQuiet();
    });
  }

  globalThis.FlowArrow.dom = { waitForSettle };
})();

// Watches for the user's response to ONE step (section 10) and reports
// exactly one StepOutcome through the onOutcome callback.
// Person A owns this file.
(function () {
  const COVER_MS = 400;
  const HIDDEN_MS = 400;
  const SCROLL_DEBOUNCE_MS = 700;
  const TICK_MS = 100;
  const URL_POLL_MS = 500;

  let active = null;

  function isFlowArrowEvent(event) {
    return !!globalThis.FlowArrow.host && event.composedPath().includes(globalThis.FlowArrow.host);
  }

  function interactiveOnPath(event) {
    for (const node of event.composedPath()) {
      if (node instanceof Element && node.matches(globalThis.FlowArrow.scanner.CANDIDATE_SELECTOR)) return node;
    }
    return null;
  }

  function hasValue(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea") return el.value.length > 0;
    if (tag === "select") return !!el.value;
    if (el.isContentEditable) return (el.innerText || "").trim().length > 0;
    return false;
  }

  function isToggleOrSelect(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "select") return true;
    if (tag === "input") {
      const type = (el.getAttribute("type") || "").toLowerCase();
      return type === "checkbox" || type === "radio";
    }
    return false;
  }

  function isCovered(el) {
    const r = el.getBoundingClientRect();
    const left = Math.max(r.left, 0);
    const right = Math.min(r.right, window.innerWidth);
    const top = Math.max(r.top, 0);
    const bottom = Math.min(r.bottom, window.innerHeight);
    if (right - left < 1 || bottom - top < 1) return false;
    const x = (left + right) / 2;
    const y = (top + bottom) / 2;
    const root = el.getRootNode();
    const ctx = root instanceof ShadowRoot && root.elementsFromPoint ? root : document;
    const hit = ctx.elementsFromPoint(x, y).find((n) => n !== globalThis.FlowArrow.host);
    return !(hit && globalThis.FlowArrow.scanner.isDescendantOrSelf(el, hit));
  }

  function isHidden(el) {
    const r = el.getBoundingClientRect();
    return r.width === 0 && r.height === 0;
  }

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    active.cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  function disarm() {
    if (!active) return;
    for (const fn of active.cleanups) fn();
    active = null;
  }

  function arm(step, element, onOutcome) {
    disarm();
    active = { cleanups: [], report: null };
    const me = active;

    function report(outcome) {
      if (active !== me) return;
      disarm();
      onOutcome(outcome);
    }
    me.report = report;

    const action = step.action;

    if (action === "click" && element) {
      listen(window, "click", (e) => {
        if (isFlowArrowEvent(e)) return;
        if (e.composedPath().includes(element)) return report("completed");
        if (interactiveOnPath(e)) report("clicked_elsewhere");
      }, true);
    }

    if (action === "type" && element) {
      const doneIfValue = () => {
        if (hasValue(element)) report("completed");
      };
      listen(window, "focusout", (e) => {
        if (e.composedPath().includes(element)) doneIfValue();
      }, true);
      listen(window, "keydown", (e) => {
        if (e.key === "Enter" && e.composedPath().includes(element)) doneIfValue();
      }, true);
      listen(window, "click", (e) => {
        if (isFlowArrowEvent(e)) return;
        if (e.composedPath().includes(element)) return;
        if (interactiveOnPath(e)) report("clicked_elsewhere");
      }, true);
    }

    if ((action === "click" || action === "type") && element && isToggleOrSelect(element)) {
      listen(window, "change", (e) => {
        if (e.composedPath().includes(element)) report("completed");
      }, true);
    }

    if (action === "scroll") {
      let timer = null;
      listen(window, "scroll", () => {
        clearTimeout(timer);
        timer = setTimeout(() => report("scrolled"), SCROLL_DEBOUNCE_MS);
      }, { capture: true, passive: true });
      me.cleanups.push(() => clearTimeout(timer));
    }

    // info / show: the overlay's button calls confirmInfo().

    const startUrl = location.href;
    let coveredSince = 0;
    let hiddenSince = 0;
    let lastUrlCheck = performance.now();
    const ticker = setInterval(() => {
      const now = performance.now();
      if (now - lastUrlCheck >= URL_POLL_MS) {
        lastUrlCheck = now;
        if (location.href !== startUrl) return report("page_changed");
      }
      if (!element) return;
      if (!element.isConnected) return report("page_changed");

      if (isHidden(element)) {
        hiddenSince = hiddenSince || now;
        if (now - hiddenSince >= HIDDEN_MS) return report("page_changed");
      } else {
        hiddenSince = 0;
      }

      if (isCovered(element)) {
        coveredSince = coveredSince || now;
        if (now - coveredSince >= COVER_MS) return report("target_covered");
      } else {
        coveredSince = 0;
      }
    }, TICK_MS);
    me.cleanups.push(() => clearInterval(ticker));
  }

  function confirmInfo() {
    if (active) active.report("confirmed");
  }

  globalThis.FlowArrow.watcher = { arm, disarm, confirmInfo, isArmed: () => !!active };
})();
