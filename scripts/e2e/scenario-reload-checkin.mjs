// (1) reload mid-flow -> widget restores + page_changed + new step
// (2) 3 off-path clicks -> check-in; Keep going resumes; then 3 more -> Stop ends
import { launch, startGoal, nextUserState, shot, flowUi, waitUi, clickShadowButton, session, hubSetPopups } from "./harness.mjs";
await hubSetPopups({ bank: 0 });
const { ctx, sw, page, pageLogs, swLogs } = await launch();
await page.goto("http://localhost:3001/reset"); await page.waitForURL("http://localhost:3001/"); await page.waitForTimeout(1200);
await startGoal(page, "pay my credit card bill");
let st = await nextUserState(sw, 0);
console.log(`t${st.s.turn} step shown:`, st.s.currentStep.instruction);

// (1) reload
await page.reload();
const restored = await waitUi(page, (u) => u.state === "thinking" || u.state === "guiding", "restored widget", 8000);
console.log("after reload widget:", restored.state, "|", restored.text);
st = await nextUserState(sw, st.s.turn);
const s = await session(sw);
console.log(`t${st.s.turn} new step:`, st.s.currentStep.instruction, "| history:", s.history.map((h) => `${h.turn}:${h.outcome}`).join(","));
const ui1 = await flowUi(page);
console.log("widget:", ui1.state, "overlay:", JSON.stringify(ui1.overlay));

// (2) off-path check-in flow: SKIPPED - the loop has no checkin state or
// offPathStreak (cut for hackathon scope), so wrong clicks re-plan instead of
// checking in. Re-enable if that behavior returns.
console.log("SKIP checkin half: no checkin state in this build (see ARCHITECTURE out-of-scope)");
await hubSetPopups({ bank: 0.33 });
await ctx.close();
