// node visual.mjs
// Screenshots every offline widget state on the bank: home, open card,
// NE toggle, goal sent with no backend (error state). Saved to .out/shots/.
import { launch, shot, flowUi, clickLauncher, clickShadowButton, shadowBox } from "./harness.mjs";

const { ctx, page } = await launch();
await page.goto("http://localhost:3001/reset");
await page.waitForURL("http://localhost:3001/");
await page.waitForTimeout(1200);
await shot(page, "v-home");
await clickLauncher(page);
await page.waitForTimeout(500);
await shot(page, "v-card");
await clickShadowButton(page, "NE");
await shot(page, "v-card-ne");
const area = await shadowBox(page, ".fa-goal");
if (area) await page.mouse.click(area.cx, area.cy);
await page.keyboard.type("pay my credit card bill");
await shot(page, "v-goal-typed");
await clickShadowButton(page, "Send");
await page.waitForTimeout(6000); // backend down -> error state; live -> first ring
await shot(page, "v-after-send");
const ui = await flowUi(page).catch(() => null);
console.log("caption:", JSON.stringify(ui && ui.caption), "pill:", ui && ui.pill, "ring:", !!(ui && ui.ring));
await ctx.close();
console.log("saved to scripts/e2e/.out/shots/v-*.png");
