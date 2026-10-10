globalThis.FlowArrow = globalThis.FlowArrow || {};

// Section 9 overlay, part 3: ring + arrow + caption + info/scroll cards.
// Person A owns this file.
(function () {
  const MARGIN = 12;
  const CURSOR_W = 34, CURSOR_H = 40, CURSOR_TIP = 2;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const cfg = () => globalThis.FlowArrow.config;

  let nodes = [];
  let cleanups = [];
  let rafId = 0;
  let pointing = null;
  let lastCursor = null;

  function add(el) {
    globalThis.FlowArrow._shadow.appendChild(el);
    nodes.push(el);
    return el;
  }

  function div(className) {
    const el = document.createElement("div");
    el.className = className;
    return el;
  }

  function stopTracking() {
    cancelAnimationFrame(rafId);
    rafId = 0;
    for (const fn of cleanups) fn();
    cleanups = [];
  }

  function clear() {
    stopTracking();
    for (const n of nodes) n.remove();
    nodes = [];
    pointing = null;
  }

  // The element's rect plus ringPad, kept inside the viewport so the ring's
  // border is never cut off at a screen edge.
  function ringRect(r) {
    const pad = cfg().ringPad;
    const edge = (lo, v, hi) => (v >= lo && v <= hi ? v : Math.max(lo, Math.min(v, hi)));
    const inX = r.right > 0 && r.left < window.innerWidth;
    const inY = r.bottom > 0 && r.top < window.innerHeight;
    return {
      left: inX ? edge(0, r.left - pad, r.left) : r.left - pad,
      top: inY ? edge(0, r.top - pad, r.top) : r.top - pad,
      right: inX ? edge(r.right, r.right + pad, window.innerWidth) : r.right + pad,
      bottom: inY ? edge(r.bottom, r.bottom + pad, window.innerHeight) : r.bottom + pad,
    };
  }

  function setBox(box, ring) {
    box.style.transform = `translate(${Math.round(ring.left)}px, ${Math.round(ring.top)}px)`;
    box.style.width = `${Math.round(ring.right - ring.left)}px`;
    box.style.height = `${Math.round(ring.bottom - ring.top)}px`;
  }

  // The arrow tip sits 62% across and 55% down the ring.
  function cursorPoint(ring) {
    return {
      x: ring.left + (ring.right - ring.left) * 0.62,
      y: ring.top + (ring.bottom - ring.top) * 0.55,
    };
  }

  function setCursor(cursor, p) {
    const s = cfg().arrowScale;
    cursor.style.transform = `translate(${p.x - CURSOR_TIP * s}px, ${p.y - CURSOR_TIP * s}px) scale(${s})`;
  }

  function distanceToRect(x, y, r) {
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    return Math.hypot(dx, dy);
  }

  // Arrow fades once the real mouse is near the ring; comes back after the
  // mouse has been far away for farMs.
  function trackProximity(box, cursor, getRing, isGliding) {
    let near = false;
    let farTimer = 0;
    const apply = () => {
      if (cursor) cursor.classList.toggle("flow-arrow-near", near && !isGliding());
      box.classList.toggle("flow-arrow-pulse", !near && !reducedMotion.matches);
    };
    const onMove = (e) => {
      const ring = getRing();
      if (!ring) return;
      const d = distanceToRect(e.clientX, e.clientY, ring);
      if (d <= cfg().nearPx) {
        clearTimeout(farTimer);
        farTimer = 0;
        if (!near) { near = true; apply(); }
      } else if (d > cfg().farPx) {
        if (near && !farTimer) farTimer = setTimeout(() => { farTimer = 0; near = false; apply(); }, cfg().farMs);
      } else {
        clearTimeout(farTimer);
        farTimer = 0;
      }
    };
    window.addEventListener("mousemove", onMove, { capture: true, passive: true });
    cleanups.push(() => {
      window.removeEventListener("mousemove", onMove, { capture: true, passive: true });
      clearTimeout(farTimer);
    });
    apply();
    return apply;
  }

  function flush(el) {
    void el.getBoundingClientRect();
  }

  function lang() {
    try {
      return globalThis.FlowArrow.widget.getLang();
    } catch {
      return "en";
    }
  }

  function caption(step, turn) {
    const el = div("flow-arrow-caption");
    const eyebrow = document.createElement("span");
    eyebrow.className = "flow-arrow-eyebrow";
    const ne = lang() === "ne";
    eyebrow.textContent = step.action === "show"
      ? (ne ? "यहाँ छ" : "Here it is")
      : (ne ? `चरण ${turn}` : `Step ${turn}`);
    const text = document.createElement("span");
    text.className = "flow-arrow-caption-text";
    text.textContent = step.instruction;
    el.append(eyebrow, text);
    if (step.action === "show") {
      el.classList.add("flow-arrow-has-btn");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "flow-arrow-btn";
      btn.textContent = ne ? "बुझें" : "Got it";
      btn.addEventListener("click", () => {
        if (globalThis.FlowArrow.watcher) globalThis.FlowArrow.watcher.confirmInfo();
      });
      el.append(btn);
    }
    return el;
  }

  function overlapArea(a, b) {
    if (!a || !b) return 0;
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  }

  function placeCaption(el, ring, cursorBox) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = cfg().captionGap;
    const clampX = (x) => Math.max(MARGIN, Math.min(x, vw - MARGIN - w));
    const clampY = (y) => Math.max(MARGIN, Math.min(y, vh - MARGIN - h));
    const belowTop = Math.max(ring.bottom + gap, cursorBox ? cursorBox.bottom + 6 : 0);
    const rightLeft = Math.max(ring.right + gap, cursorBox ? cursorBox.right + 6 : 0);
    const candidates = [
      { left: clampX(ring.left), top: belowTop, fits: belowTop + h <= vh - MARGIN },
      { left: clampX(ring.left), top: ring.top - gap - h, fits: ring.top - gap - h >= MARGIN },
      { left: rightLeft, top: clampY(ring.top), fits: rightLeft + w <= vw - MARGIN },
      { left: ring.left - gap - w, top: clampY(ring.top), fits: ring.left - gap - w >= MARGIN },
    ];
    const dock = globalThis.FlowArrow.widget.rect ? globalThis.FlowArrow.widget.rect() : null;
    const rectOf = (c) => ({ left: c.left, top: c.top, right: c.left + w, bottom: c.top + h });
    const fitting = candidates.filter((c) => c.fits);
    let best =
      fitting.find((c) => !overlapArea(rectOf(c), ring) && !overlapArea(rectOf(c), dock)) ||
      fitting.find((c) => !overlapArea(rectOf(c), ring));
    if (!best) {
      best = candidates
        .map((c) => ({ left: clampX(c.left), top: clampY(c.top) }))
        .sort((a, b) => overlapArea(rectOf(a), ring) - overlapArea(rectOf(b), ring))[0];
    }
    el.style.transform = `translate(${Math.round(best.left)}px, ${Math.round(best.top)}px)`;
  }

  function cursorBoxAt(p) {
    const s = cfg().arrowScale;
    return { left: p.x, top: p.y, right: p.x + (CURSOR_W - CURSOR_TIP) * s, bottom: p.y + (CURSOR_H - CURSOR_TIP) * s };
  }

  function showPointing(step, element, turn) {
    const glide = !reducedMotion.matches;
    const withCursor = step.action !== "show";
    const box = add(div("flow-arrow-box"));
    const cap = add(caption(step, turn));
    const cursor = withCursor ? add(globalThis.FlowArrow.icons.arrow("flow-arrow-cursor")) : null;
    pointing = { box, cursor, cap };
    box.classList.add("flow-arrow-on");
    cap.classList.add("flow-arrow-on");
    if (cursor) cursor.classList.add("flow-arrow-on");

    const target = ringRect(element.getBoundingClientRect());
    let gliding = false;
    setBox(box, target);

    if (cursor) {
      const start = glide ? lastCursor || (globalThis.FlowArrow.widget.anchor && globalThis.FlowArrow.widget.anchor()) : null;
      setCursor(cursor, start || cursorPoint(target));
    }
    flush(box);

    if (glide && cursor) {
      gliding = true;
      cursor.classList.add("flow-arrow-gliding");
      const t = setTimeout(() => {
        gliding = false;
        cursor.classList.remove("flow-arrow-gliding");
        applyProximity();
      }, cfg().glideMs + 30);
      cleanups.push(() => clearTimeout(t));
    }

    let ring = null;
    const applyProximity = trackProximity(box, cursor, () => ring, () => gliding);

    let last = "";
    const frame = () => {
      rafId = requestAnimationFrame(frame);
      if (!element.isConnected) return;
      const r = element.getBoundingClientRect();
      const key = `${r.left}|${r.top}|${r.width}|${r.height}|${window.innerWidth}|${window.innerHeight}`;
      if (key === last) return;
      last = key;
      ring = ringRect(r);
      setBox(box, ring);
      let cursorBox = null;
      if (cursor) {
        const p = cursorPoint(ring);
        lastCursor = p;
        setCursor(cursor, p);
        cursorBox = cursorBoxAt(p);
      }
      placeCaption(cap, ring, cursorBox);
      if (globalThis.FlowArrow.widget.avoid) globalThis.FlowArrow.widget.avoid(ring);
    };
    frame();
  }

  function showInfo(step, turn) {
    const ne = lang() === "ne";
    const card = add(div("flow-arrow-card"));
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-live", "polite");
    const eyebrow = document.createElement("span");
    eyebrow.className = "flow-arrow-eyebrow";
    eyebrow.textContent = ne ? `चरण ${turn}` : `Step ${turn}`;
    const text = document.createElement("div");
    text.textContent = step.instruction;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "flow-arrow-btn flow-arrow-primary";
    btn.textContent = ne ? "मैले गरें" : "I did it";
    btn.addEventListener("click", () => {
      if (globalThis.FlowArrow.watcher) globalThis.FlowArrow.watcher.confirmInfo();
    });
    card.append(eyebrow, text, btn);
  }

  function showScroll(step, turn) {
    const down = step.scrollDirection !== "up";
    const arrow = add(div(`flow-arrow-edge ${down ? "flow-arrow-down" : "flow-arrow-up"}`));
    arrow.append(globalThis.FlowArrow.icons.scrollArrow(!down));
    const cap = add(caption(step, turn));
    const place = () => {
      const w = cap.offsetWidth;
      const h = cap.offsetHeight;
      const left = Math.max(MARGIN, (window.innerWidth - w) / 2);
      const top = down ? window.innerHeight - 28 - 64 - 18 - h : 28 + 64 + 18;
      cap.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    };
    place();
    window.addEventListener("resize", place);
    cleanups.push(() => window.removeEventListener("resize", place));
    flush(cap);
    cap.classList.add("flow-arrow-on");
  }

  function showStep(step, element, turn) {
    clear();
    if (!globalThis.FlowArrow._shadow) return;
    if ((step.action === "click" || step.action === "type" || step.action === "show") && element) {
      showPointing(step, element, turn);
    }
    else if (step.action === "scroll") showScroll(step, turn);
    else showInfo(step, turn);
  }

  function complete() {
    if (!pointing) return clear();
    const { box, cursor, cap } = pointing;
    stopTracking();
    const left = nodes;
    nodes = [];
    pointing = null;
    box.classList.remove("flow-arrow-pulse", "flow-arrow-gliding");
    box.classList.add("flow-arrow-complete");
    const check = div("flow-arrow-check");
    check.append(globalThis.FlowArrow.icons.check(16, "#fff", 3));
    box.append(check);
    if (cursor) cursor.classList.remove("flow-arrow-on", "flow-arrow-near");
    if (cap) cap.classList.add("flow-arrow-leaving");
    const t1 = setTimeout(() => box.classList.add("flow-arrow-leaving"), cfg().completeMs);
    const t2 = setTimeout(() => { for (const n of left) n.remove(); }, cfg().completeMs + 200);
    cleanups.push(() => { clearTimeout(t1); clearTimeout(t2); });
  }

  function updateCaption(step) {
    const shadow = globalThis.FlowArrow._shadow;
    const text = shadow && shadow.querySelector(".flow-arrow-caption-text");
    if (!text || text.textContent === step.instruction) return;
    text.textContent = step.instruction;
  }

  globalThis.FlowArrow.overlay = { showStep, clear, complete, updateCaption };
})();
