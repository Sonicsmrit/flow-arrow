// Turns provider answers into the one Step the extension gets: validation
// retry, done-resolution retry, fallback step.
import { validateStep, type Lang, type NextStepRequest, type Step } from "./schema.ts";
import type { ProviderAnswer } from "./providers/index.ts";

export function fallbackStep(lang: Lang): Step {
  return {
    reasoning: "",
    action: "info",
    elementId: null,
    scrollDirection: null,
    instruction:
      lang === "ne"
        ? "अर्को कहाँ थिच्ने भन्ने पक्का भएन। स्क्रोल गर्नुहोस् वा लक्ष्य खुलाउनुहोस्।"
        : "I'm not sure where to click next. Try scrolling, or tell me more about what you want.",
    confidence: "low",
    done: false,
  };
}

const DONE_NOTE =
  'You answered done: true together with a click/type/scroll. If the GOAL is already achieved on this screen, answer done: true with action "info" (or "show" on the answer for a question), and a short congratulation or the answer. If one more action is still needed to achieve it, answer that action with done: false.';

// A "done" whose words say it failed ("Sorry, this part isn't available...")
// is giving up, not success: Flow Arrow must never say "You did it!" over a
// failure. Covers English + Nepali give-up phrasing.
const GIVING_UP =
  /\b(sorry|not available|isn't available|is not available|unavailable|can't|cannot|unable|not possible|माफ|उपलब्ध छैन|सक्दिन|सकिएन|मिल्दैन)\b/i;
const GIVE_UP_NOTE =
  'You answered done: true, but your instruction says the task could not be done, so the GOAL is NOT achieved. A "not available" message means that path is a dead end: ' +
  "go another way toward the goal from the current screen (the account pages, a different link, or the main menu), with done: false.";

function givesUp(step: Step): boolean {
  return step.done && GIVING_UP.test(step.instruction);
}

const STOP_WORDS = new Set(["the", "and", "for", "your", "you", "button", "link", "box", "click", "type", "tap", "this", "that", "with", "then", "here", "top", "bottom", "left", "right"]);
const words = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

// Catches a wrong number for the right idea ("Click the green Continue
// button" with the id of "Back"): the instruction names a Capitalized word
// that shares nothing with the chosen element's label. English-only: the
// word splitting false-fires on Devanagari, so callers gate it to lang=="en".
export function instructionMismatch(req: NextStepRequest, step: Step): string | null {
  if (step.action !== "click" && step.action !== "type") return null;
  const el = req.elements.find((e) => e.id === step.elementId);
  if (!el || !el.label.trim()) return null;
  const labelWords = new Set(words(el.label));
  if (labelWords.size === 0) return null;
  const instrWords = words(step.instruction);
  if (instrWords.some((w) => labelWords.has(w))) return null;
  // Capitalized words after the first one: names of things on screen.
  const named = step.instruction
    .split(/\s+/)
    .slice(1)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
    .filter((w) => /^[A-Z][a-z]{2,}/.test(w) && !STOP_WORDS.has(w.toLowerCase()));
  if (named.length === 0) return null;
  const word = named[0];
  return (
    `Element ${el.id} is "${el.label}", but your instruction talks about "${word}". Check the number again: each tag sits inside the top-left corner of its own box (or just outside a very small box) and has the box's color. ` +
    `If "${word}" has no tag, it is disabled or not on the list: do the step that enables it first.`
  );
}

export type Decision = {
  step: Step;
  answer: ProviderAnswer; // the answer the step came from (or the last one)
  attempt: number; // model calls made
};

export type Ask = (note?: string) => Promise<ProviderAnswer>;

// A done step is final only with "info" (no element) or "show" (the answer).
function doneIsAmbiguous(step: Step): boolean {
  return step.done && step.action !== "info" && step.action !== "show";
}

// Anti-429: hard cap of 3 model calls per turn. Validation + give-up retries
// take priority; soft checks are skipped once the budget is spent.
const MAX_CALLS_PER_TURN = 3;

export async function decideStep(req: NextStepRequest, ask: Ask): Promise<Decision> {
  let calls = 0;
  const askCounted = async (note?: string): Promise<ProviderAnswer> => {
    calls++;
    return ask(note);
  };
  const canRetry = () => calls < MAX_CALLS_PER_TURN;

  let answer = await askCounted();
  let validation = validateStep(answer.step, req.elements, req.page);

  if (!validation.ok && canRetry()) {
    console.warn(`t${req.turn} invalid step (${validation.reason}), retrying once`);
    answer = await askCounted(validation.note);
    validation = validateStep(answer.step, req.elements, req.page);
  }

  let step = answer.step;
  const mismatch =
    validation.ok && req.lang === "en" ? instructionMismatch(req, step) : null;
  if (!validation.ok) {
    step = { ...fallbackStep(req.lang), reasoning: `Model repeatedly gave an invalid step: ${validation.reason}` };
  } else if (givesUp(step) && canRetry()) {
    console.warn(`t${req.turn} done:true but the instruction gives up, asking again`);
    const again = await askCounted(GIVE_UP_NOTE);
    if (validateStep(again.step, req.elements, req.page).ok) {
      answer = again;
      step = again.step;
    }
  } else if (mismatch && canRetry()) {
    // Soft check: the retry's answer is used whatever it says (if valid).
    console.warn(`t${req.turn} instruction/label mismatch on #${step.elementId}, retrying once`);
    const again = await askCounted(mismatch);
    if (validateStep(again.step, req.elements, req.page).ok) {
      answer = again;
      step = again.step;
    }
  } else if (doneIsAmbiguous(step) && canRetry()) {
    // done:true on a click/type/scroll is ambiguous: "goal reached (and here
    // is a Back link)" or "this click is the last step". Guessing wrong
    // either congratulates too early or repeats a finished task (a second
    // payment), so ask the model once to make up its mind.
    console.warn(`t${req.turn} done:true on a ${step.action} step, asking the model to resolve it`);
    const again = await askCounted(DONE_NOTE);
    if (validateStep(again.step, req.elements, req.page).ok) {
      answer = again;
      step = again.step;
    }
  }
  if (givesUp(step)) {
    console.warn(`t${req.turn} still giving up after the retry: not treating it as done`);
    step = { ...step, done: false };
  }
  if (doneIsAmbiguous(step)) {
    console.warn(`t${req.turn} still done:true on a ${step.action} step, treating as done:false`);
    step = { ...step, done: false };
  }
  return { step, answer, attempt: calls };
}
