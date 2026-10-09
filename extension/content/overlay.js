globalThis.FlowArrow = globalThis.FlowArrow || {};

// Section 9 overlay, part 2: ring + dim + arrow glide with proximity fade.
// Person A owns this file.
(function () {
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

  function showPointing(_step, element) {
    const glide = !reducedMotion.matches;
    const box = add(div("flow-arrow-box"));
    const cursor = add(globalThis.FlowArrow.icons.arrow("flow-arrow-cursor"));
    pointing = { box, cursor };
    box.classList.add("flow-arrow-on");
    cursor.classList.add("flow-arrow-on");

    const target = ringRect(element.getBoundingClientRect());
    let gliding = false;
    setBox(box, target);

    const start = glide ? lastCursor : null;
    setCursor(cursor, start || cursorPoint(target));
    flush(box);

    if (glide) {
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

    const frame = () => {
      rafId = requestAnimationFrame(frame);
      if (!element.isConnected) return;
      const r = element.getBoundingClientRect();
      ring = ringRect(r);
      setBox(box, ring);
      const p = cursorPoint(ring);
      lastCursor = p;
      setCursor(cursor, p);
    };
    frame();
  }

  function showStep(step, element) {
    clear();
    if (!globalThis.FlowArrow._shadow) return;
    if ((step.action === "click" || step.action === "type" || step.action === "show") && element) {
      showPointing(step, element);
    }
  }

  function complete() {
    return clear();
  }

  function updateCaption() {
    // Part 3 adds caption text updates.
  }

  globalThis.FlowArrow.overlay = { showStep, clear, complete, updateCaption };
})();
