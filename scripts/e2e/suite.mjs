// node suite.mjs --smoke
// Exit 0: all runnable scenarios pass. Exit 1: a scenario failed.
// Exit 2: backend unreachable, only offline scenarios ran (integration pending).
import { launch, startGoal, flowUi, shot, follow, appState, hubSetPopups, backendHealthy, backendUrl, session } from "./harness.mjs";

const smoke = process.argv.includes("--smoke");
if (!smoke) {
  console.log("usage: node suite.mjs --smoke");
  process.exit(2);
}

let pass = 0, fail = 0;
const note = (ok, name, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " - " + detail : ""}`);
  ok ? pass++ : fail++;
};

const online = await backendHealthy();
console.log(`backend: ${online ? `${backendUrl()} ${JSON.stringify(online)}` : `${backendUrl()} UNREACHABLE (HERO scenarios need it)`}`);

// 1. Widget boots offline: launcher opens the goal card on the bank.
{
  const { ctx, page } = await launch();
  try {
    await page.goto("http://localhost:3001/reset");
    await page.waitForURL("http://localhost:3001/");
    await page.waitForTimeout(1200);
    await shot(page, "smoke-home");
    const { clickLauncher } = await import("./harness.mjs");
    await clickLauncher(page);
    await page.waitForTimeout(500);
    const ui = await flowUi(page);
    await shot(page, "smoke-card");
    note(!!(ui && ui.cardOpen), "widget-boots", ui && ui.buttons.map((b) => b.label).join(","));
  } catch (e) {
    note(false, "widget-boots", e.message.slice(0, 160));
  }
  await ctx.close();
}

// 2+3. Live goals only when the backend answers.
if (online) {
  await hubSetPopups({ bank: 0 });
  // HERO EN: pay the credit card bill from a logged-out bank.
  {
    const { ctx, sw, page } = await launch();
    try {
      await page.goto("http://localhost:3001/reset");
      await page.waitForURL("http://localhost:3001/");
      await page.waitForTimeout(1200);
      const t0 = Date.now();
      await startGoal(page, "pay my credit card bill", "en");
      const r = await follow(page, sw, { maxTurns: 30 });
      const st = await appState(page);
      const paid = st && (st.cardBalance < 642.37 || st.statementBalance === 0);
      note(r.end === "ended" && paid, "hero-en-pay-card", `${r.end} ${r.steps.length} steps ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    } catch (e) {
      note(false, "hero-en-pay-card", e.message.slice(0, 160));
    }
    await ctx.close();
  }
  // Tell-me: checking balance ends the session.
  {
    const { ctx, sw, page } = await launch();
    try {
      await page.goto("http://localhost:3001/reset");
      await page.waitForURL("http://localhost:3001/");
      await page.waitForTimeout(1200);
      await startGoal(page, "what is my checking balance", "en");
      const r = await follow(page, sw, { maxTurns: 20 });
      note(r.end === "ended", "tell-me-balance", `${r.end} ${r.steps.length} steps`);
    } catch (e) {
      note(false, "tell-me-balance", e.message.slice(0, 160));
    }
    await ctx.close();
  }
  await hubSetPopups({ bank: 0.33 });
}

console.log(`smoke: ${pass} pass, ${fail} fail${online ? "" : " (offline only)"}`);
process.exit(fail ? 1 : online ? 0 : 2);
