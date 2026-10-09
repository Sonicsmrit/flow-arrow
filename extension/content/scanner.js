globalThis.FlowArrow = globalThis.FlowArrow || {};

// Section 7 scanner: interactive candidates only (no text landmarks in this build).
// Person A owns this file.
(function () {
  const CANDIDATE_SELECTOR = [
    "a[href]",
    "button",
    "input:not([type=hidden])",
    "select",
    "textarea",
    "[role=button]",
    "[role=link]",
    "[role=checkbox]",
    "[role=radio]",
    "[role=tab]",
    "[role=textbox]",
    "[role=combobox]",
    "[tabindex]:not([tabindex='-1'])",
  ].join(", ");

  const ALLOWED_ROLES = new Set([
    "button",
    "link",
    "checkbox",
    "radio",
    "tab",
    "menuitem",
    "option",
    "switch",
    "textbox",
    "combobox",
  ]);

  // Hackathon cap: max 100 elements for stage speed.
  const MAX_ELEMENTS = 100;

  let latestScanId = 0;
  let latestMap = new Map(); // id -> Element

  function isFlowArrowHost(el) {
    return el.tagName && el.tagName.toLowerCase() === "flow-arrow-root";
  }

  function insideFlowArrowHost(el) {
    let node = el;
    while (node) {
      if (isFlowArrowHost(node)) return true;
      node = getParentAcrossShadow(node);
    }
    return false;
  }

  function getParentAcrossShadow(el) {
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode();
    if (root instanceof ShadowRoot) return root.host;
    return null;
  }

  function collectCandidates(root, out) {
    const found = root.querySelectorAll(CANDIDATE_SELECTOR);
    for (const el of found) out.push(el);

    // Recurse into every open shadow root under `root`.
    const all = root.querySelectorAll("*");
    for (const el of all) {
      if (el.shadowRoot) {
        collectCandidates(el.shadowRoot, out);
      }
    }
  }

  function intersectsViewport(rect) {
    return (
      rect.width >= 4 &&
      rect.height >= 4 &&
      rect.right > 0 &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.top < window.innerHeight
    );
  }

  function isStyleVisible(el) {
    const style = getComputedStyle(el);
    if (style.display === "none") return false;
    if (style.visibility === "hidden") return false;
    if (parseFloat(style.opacity) <= 0.05 && !isClearOverlayControl(el)) return false;
    if (el.disabled) return false;
    return true;
  }

  // A see-through form control laid over a painted button or dropdown, so the
  // user's click lands on it. Kept only if real-sized and its wrapper is
  // visible; the topmost check still applies afterwards.
  const OVERLAY_TAGS = new Set(["INPUT", "SELECT", "BUTTON"]);
  function isClearOverlayControl(el) {
    if (!OVERLAY_TAGS.has(el.tagName)) return false;
    if (el.tagName === "INPUT" && (el.type === "hidden" || el.type === "file")) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 12 || r.height < 12) return false;
    const wrap = getParentAcrossShadow(el);
    if (!wrap || !wrap.getBoundingClientRect) return false;
    const ws = getComputedStyle(wrap);
    if (ws.visibility === "hidden" || parseFloat(ws.opacity) <= 0.05) return false;
    const w = wrap.getBoundingClientRect();
    const overlapW = Math.min(r.right, w.right) - Math.max(r.left, w.left);
    const overlapH = Math.min(r.bottom, w.bottom) - Math.max(r.top, w.top);
    return overlapW > 0 && overlapH > 0 && (overlapW * overlapH) / (r.width * r.height) >= 0.5;
  }

  function isAriaHiddenChain(el) {
    let node = el;
    while (node) {
      if (node.getAttribute && node.getAttribute("aria-hidden") === "true") return true;
      node = getParentAcrossShadow(node);
    }
    return false;
  }

  function elementFromPointInContext(el, x, y) {
    const root = el.getRootNode();
    if (root instanceof ShadowRoot && typeof root.elementFromPoint === "function") {
      return root.elementFromPoint(x, y);
    }
    return document.elementFromPoint(x, y);
  }

  function isDescendantOrSelf(target, candidate) {
    let node = candidate;
    while (node) {
      if (node === target) return true;
      node = getParentAcrossShadow(node);
    }
    return false;
  }

  function isTopmost(el, rect) {
    const visibleLeft = Math.max(rect.left, 0);
    const visibleRight = Math.min(rect.right, window.innerWidth);
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, window.innerHeight);
    const midY = (visibleTop + visibleBottom) / 2;

    const points = [
      [(visibleLeft + visibleRight) / 2, midY],
      [visibleLeft + (visibleRight - visibleLeft) * 0.25, midY],
      [visibleLeft + (visibleRight - visibleLeft) * 0.75, midY],
    ];

    for (const [x, y] of points) {
      const hit = elementFromPointInContext(el, x, y);
      if (hit && isDescendantOrSelf(el, hit)) return true;
    }
    return false;
  }

  function collapseWhitespace(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function labelFromAriaLabelledBy(el) {
    const ids = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
    if (ids.length === 0) return "";
    const root = el.getRootNode();
    const texts = [];
    for (const id of ids) {
      const target = root.getElementById ? root.getElementById(id) : document.getElementById(id);
      if (target) texts.push(collapseWhitespace(target.innerText || target.textContent));
    }
    return texts.join(" ").trim();
  }

  function labelFromWrappingLabel(el) {
    if (el.id) {
      const root = el.getRootNode();
      const forLabel = root.querySelector
        ? root.querySelector(`label[for="${CSS.escape(el.id)}"]`)
        : null;
      if (forLabel) return collapseWhitespace(forLabel.innerText || forLabel.textContent);
    }
    const wrapping = el.closest ? el.closest("label") : null;
    if (wrapping) return collapseWhitespace(wrapping.innerText || wrapping.textContent);
    return "";
  }

  function computeLabel(el) {
    const ariaLabel = el.getAttribute && el.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim().slice(0, 80);

    const labelledBy = labelFromAriaLabelledBy(el);
    if (labelledBy) return labelledBy.slice(0, 80);

    const wrappingLabel = labelFromWrappingLabel(el);
    if (wrappingLabel) return wrappingLabel.slice(0, 80);

    const innerText = collapseWhitespace(el.innerText || el.textContent);
    if (innerText) return innerText.slice(0, 80);

    const placeholder = el.getAttribute && el.getAttribute("placeholder");
    if (placeholder && placeholder.trim()) return placeholder.trim().slice(0, 80);

    const title = el.getAttribute && el.getAttribute("title");
    if (title && title.trim()) return title.trim().slice(0, 80);

    const firstImg = el.querySelector ? el.querySelector("img") : null;
    if (firstImg) {
      const alt = firstImg.getAttribute("alt");
      if (alt && alt.trim()) return alt.trim().slice(0, 80);
    }

    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (tag === "input") {
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type === "submit" || type === "button") {
        const value = el.getAttribute("value");
        if (value && value.trim()) return value.trim().slice(0, 80);
      }
    }

    const name = el.getAttribute && el.getAttribute("name");
    if (name && name.trim()) return name.trim().slice(0, 80);

    return "";
  }

  function computeRole(el) {
    const explicitRole = (el.getAttribute && el.getAttribute("role") || "").toLowerCase();
    if (ALLOWED_ROLES.has(explicitRole)) return explicitRole;

    const tag = el.tagName.toLowerCase();
    if (tag === "a") return "link";
    if (tag === "button") return "button";
    if (tag === "input") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (type === "submit" || type === "button" || type === "reset") return "button";
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      return "textbox";
    }
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (el.isContentEditable) return "textbox";
    return "other";
  }

  function computeInputType(el) {
    if (el.tagName && el.tagName.toLowerCase() === "input") {
      return (el.getAttribute("type") || "text").toLowerCase();
    }
    return undefined;
  }

  // Only typeable elements get hasValue (a checkbox's .value is "on", which
  // would wrongly read as "already filled in"). Never the value itself.
  function computeHasValue(el, role) {
    if (role !== "textbox" && role !== "combobox") return undefined;
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea") {
      return el.value.length > 0;
    }
    if (tag === "select") {
      return !!el.value;
    }
    if (el.isContentEditable) {
      return collapseWhitespace(el.innerText || el.textContent).length > 0;
    }
    return false;
  }

  function computeChecked(el, role) {
    if (role === "tab") {
      const selected = el.getAttribute && el.getAttribute("aria-selected");
      return selected === "true" ? true : selected === "false" ? false : undefined;
    }
    if (role !== "checkbox" && role !== "radio" && role !== "switch") return undefined;
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (tag === "input") return !!el.checked;
    const aria = el.getAttribute && el.getAttribute("aria-checked");
    if (aria === "true") return true;
    if (aria === "false") return false;
    return undefined;
  }

  function computeFocused(el) {
    const root = el.getRootNode();
    const active = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
    return active === el;
  }

  function rectArea(rect) {
    return rect.width * rect.height;
  }

  function overlapRatio(a, b) {
    const left = Math.max(a.left, b.left);
    const right = Math.min(a.right, b.right);
    const top = Math.max(a.top, b.top);
    const bottom = Math.min(a.bottom, b.bottom);
    if (right <= left || bottom <= top) return 0;
    const intersection = (right - left) * (bottom - top);
    const smaller = Math.min(rectArea(a), rectArea(b));
    return smaller === 0 ? 0 : intersection / smaller;
  }

  function dedupe(items) {
    // items: [{el, rect, role}], in document order.
    const kept = [];
    for (const item of items) {
      let dropped = false;
      for (let i = 0; i < kept.length; i++) {
        const other = kept[i];
        const isAncestor = isDescendantOrSelf(other.el, item.el) && other.el !== item.el;
        const isDescendant = isDescendantOrSelf(item.el, other.el) && other.el !== item.el;
        if (!isAncestor && !isDescendant) continue;

        const ratio = overlapRatio(item.rect, other.rect);
        if (ratio <= 0.85) continue;

        if (isAncestor) {
          if (item.role === "textbox") {
            kept.splice(i, 1);
            break;
          }
          dropped = true;
          break;
        }
        if (isDescendant) {
          if (other.role === "textbox") {
            dropped = true;
            break;
          }
          kept.splice(i, 1);
          break;
        }
      }
      if (!dropped) kept.push(item);
    }
    return kept;
  }

  function scan() {
    const rawCandidates = [];
    collectCandidates(document, rawCandidates);

    const items = [];
    const seen = new Set();

    for (const el of rawCandidates) {
      if (seen.has(el)) continue;
      seen.add(el);

      if (insideFlowArrowHost(el)) continue;

      const rect = el.getBoundingClientRect();
      if (!intersectsViewport(rect)) continue;
      if (!isStyleVisible(el)) continue;
      if (isAriaHiddenChain(el)) continue;
      if (!isTopmost(el, rect)) continue;

      const role = computeRole(el);
      items.push({ el, rect, role });
    }

    const deduped = dedupe(items);

    let capped = deduped;
    if (deduped.length > MAX_ELEMENTS) {
      capped = [...deduped]
        .sort((a, b) => rectArea(b.rect) - rectArea(a.rect))
        .slice(0, MAX_ELEMENTS);
      // Re-sort by original document order (index in `deduped`).
      const order = new Map(deduped.map((item, idx) => [item, idx]));
      capped.sort((a, b) => order.get(a) - order.get(b));
    }

    const map = new Map();
    const elements = capped.map((item, idx) => {
      const id = idx + 1;
      map.set(id, item.el);
      const role = item.role;
      const info = {
        id,
        role,
        label: computeLabel(item.el),
        rect: {
          x: Math.round(item.rect.left),
          y: Math.round(item.rect.top),
          w: Math.round(item.rect.width),
          h: Math.round(item.rect.height),
        },
      };
      const inputType = computeInputType(item.el);
      if (inputType !== undefined) info.inputType = inputType;
      const hasValue = computeHasValue(item.el, role);
      if (hasValue !== undefined) info.hasValue = hasValue;
      const checked = computeChecked(item.el, role);
      if (checked !== undefined) info.checked = checked;
      const focused = computeFocused(item.el);
      if (focused) info.focused = true;
      return info;
    });

    latestScanId += 1;
    latestMap = map;

    const page = {
      url: location.href,
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      devicePixelRatio: window.devicePixelRatio || 1,
      scrollY: Math.round(window.scrollY),
      scrollMaxY: Math.max(
        0,
        Math.round(document.scrollingElement.scrollHeight - window.innerHeight)
      ),
    };

    return { scanId: latestScanId, page, elements };
  }

  function getElement(id) {
    return latestMap.get(id) || null;
  }

  function debugDraw(result) {
    const shadow = globalThis.FlowArrow._shadow;
    if (!shadow) return;
    const old = shadow.querySelectorAll(".flow-arrow-debug-tag, .flow-arrow-debug-box");
    old.forEach((n) => n.remove());

    for (const info of result.elements) {
      const box = document.createElement("div");
      box.className = "flow-arrow-debug-box";
      box.style.left = `${info.rect.x}px`;
      box.style.top = `${info.rect.y}px`;
      box.style.width = `${info.rect.w}px`;
      box.style.height = `${info.rect.h}px`;
      shadow.appendChild(box);

      const tag = document.createElement("div");
      tag.className = "flow-arrow-debug-tag";
      tag.textContent = String(info.id);
      tag.style.left = `${info.rect.x}px`;
      tag.style.top = `${Math.max(0, info.rect.y - 16)}px`;
      shadow.appendChild(tag);
    }
  }

  globalThis.FlowArrow.scanner = {
    scan,
    getElement,
    debugDraw,
    CANDIDATE_SELECTOR,
    isDescendantOrSelf,
    elementFromPointInContext,
  };
})();
