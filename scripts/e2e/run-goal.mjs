// node run-goal.mjs <startUrl> "<goal>" [--lang ne] [maxTurns]
// Drives one goal on the bank like a user who does whatever Flow Arrow points at.
import { launch, startGoal, nextUserState, doStep, shot, flowUi, hubSetPopups } from "./harness.mjs";

const args = process.argv.slice(2);
const startUrl = args[0];
const goal = args[1];
const langIdx = args.indexOf("--lang");
const lang = langIdx >= 0 ? args[langIdx + 1] : "en";
const maxArg = Number(args.find((a) => /^\d+$/.test(a)) || 20);
if (!startUrl || !goal) {
  console.log('usage: node run-goal.mjs http://localhost:3001/ "pay my credit card bill" [--lang ne] [maxTurns]');
  process.exit(2);
}
await hubSetPopups({ bank: 0 });
const { ctx, sw, page } = await launch();
const origin = new URL(startUrl).origin;
await page.goto(origin + "/reset");
await page.waitForURL(origin + "/");
await page.waitForTimeout(600);
if (startUrl !== origin + "/") await page.goto(startUrl);
await page.waitForTimeout(1200);
const tag = new URL(startUrl).port;
await startGoal(page, goal, lang);
let turn = 0, result = "max turns";
const t0 = Date.now();
for (let i = 0; i < maxArg; i++) {
  let st;
  try { st = await nextUserState(sw, turn, 90000); } catch (e) { result = "stuck: " + e.message.slice(0, 120); break; }
  if (st.kind === "ended") { const ui = await flowUi(page).catch(() => null); result = `ENDED caption="${ui && ui.caption}"`; break; }
  if (st.kind !== "step") { const ui = await flowUi(page).catch(() => null); result = `${st.kind}: ${(ui && ui.caption) || ""}`; break; }
  turn = st.s.turn;
  await page.waitForTimeout(250);
  await shot(page, `${tag}-t${turn}`);
  const what = await doStep(page, st.s);
  console.log(`t${turn} [${((Date.now() - t0) / 1000).toFixed(1)}s] ${st.s.currentStep.action} "${st.s.currentStep.instruction}" -> ${what} | ${page.url().replace(origin, "")}`);
}
await page.waitForTimeout(400);
await shot(page, `${tag}-final`);
console.log("RESULT:", result, `(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
await hubSetPopups({ bank: 0.33 });
await ctx.close();
