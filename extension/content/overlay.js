globalThis.FlowArrow = globalThis.FlowArrow || {};

// Section 9 overlay, part 1: ring + dim only (no arrow, no caption yet).
// Person A owns this file.
(function () {
  const cfg = () => globalThis.FlowArrow.config;

  let nodes = [];
  let rafId = 0;
  let pointing = null;

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

  function showPointing(_step, element) {
    const box = add(div("flow-arrow-box"));
    pointing = { box };
    box.classList.add("flow-arrow-on");

    const frame = () => {
      rafId = requestAnimationFrame(frame);
      if (!element.isConnected) return;
      const r = element.getBoundingClientRect();
      setBox(box, ringRect(r));
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
