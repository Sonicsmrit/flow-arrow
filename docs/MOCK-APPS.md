# Flow Arrow demo apps - specification

One fake-but-realistic bank app + a Demo Hub, used to demo Flow Arrow to hackathon judges. Flow Arrow (the Chrome extension) must treat them like any real website, so these apps must look and behave like real sites and contain NOTHING made for Flow Arrow.

This file is the reference for what each app does and which tasks it supports. Person C owns this folder.

## 1. Ground rules (contract with the Flow Arrow extension)

1. **No Flow Arrow hints.** No `data-flowarrow*`, no ids/classes/text that exist to help Flow Arrow. `data-testid` is also not needed; do not add it.
2. **Semantic, well-labeled HTML**, like a well-built real site: real `<button>` for actions, `<a href>` for navigation, `<label for>` on every field, `aria-label` on every icon-only button ("Close", "Account menu", "Pay bill"), `role="dialog" aria-modal="true" aria-labelledby` on modals. Accessible names are how Flow Arrow reads the page, exactly like a screen reader.
3. **Realistic look and density.** Not a wireframe. Real brand feel, real copy, fake names only (no real company names or logos).
4. **Fully offline assets.** No CDN, no Google Fonts link, no remote images. Fonts via system fonts or vendored woff2; images as inline SVG, CSS art, or emoji.
5. **Routing with real paths** (React Router `BrowserRouter`), so the URL changes on navigation like a modern site. nginx serves `index.html` for unknown paths so deep links and `/reset` work on reload.
6. **State in `localStorage`** under one prefix per app (`himalbank:`). Survives reloads. `/reset` removes every key with that prefix plus `sessionStorage`, then `location.replace("/")`.
7. **Not-in-demo links:** most nav/footer links exist for realism. Links/buttons for features that are not built show a small toast "This part of the site isn't available in the demo." and do not navigate. Nothing may ever show a blank page or crash.
8. **Flow Arrow widget space:** Flow Arrow puts a small launcher in the bottom-right corner (about 80x80 px, bigger when open). Do not put an app's ONLY way to do something in a fixed bottom-right floating element. (Normal page content scrolling under that corner is fine.)
9. **Viewport:** must look right from 1024 to 1920 px wide at 100% and 125% zoom. Mobile layouts are not needed but nothing should overflow horizontally at 1024 px.
10. **Deterministic data** (hardcoded seeds below). Only popups are random.

Demo user: **username `eluu`, password `1234`, name Edwin Luu**. Email `edwin.luu@example.com`, phone `(305) 555-0147`. Wrong credentials show an inline error "Your username or password is incorrect." (no lockout).

## 2. Tech stack and layout

```
demo-apps/
  package.json              npm workspaces: shared, hub, bank
  docker-compose.yml        services hub:3000, bank:3001
  Dockerfile.app            multi-stage: node:24-alpine build (ARG APP) -> nginx:alpine serve dist
  nginx.conf                SPA fallback: try_files $uri $uri/ /index.html
  shared/                   TS + React helpers used by both apps (NOT a shared look)
    src/storage.ts          prefixed localStorage helpers + resetApp(prefix)
    src/auth.tsx            AuthProvider, useAuth, RequireAuth (redirects to /login?next=<path>)
    src/Modal.tsx           accessible dialog with backdrop + X (aria-label "Close")
    src/Toast.tsx           toast system + notInDemo() helper
    src/ResetRoute.tsx      the /reset route component
    src/format.ts           money, date formatting
    src/demoUser.ts         DEMO_USER constant
  hub/                      Node 24 server (TS run directly) + static public/index.html (no React needed)
  bank/                     Vite + React + TypeScript app with its OWN CSS + brand
```

- Vite + React + TypeScript + React Router (current stable). Plain CSS files with CSS variables (no Tailwind needed).
- `docker compose up -d --build` from `demo-apps/` starts everything; hub data (settings JSON) lives in a named volume so it survives restarts.
- Ports are published on all interfaces so Windows Chrome reaches them via WSL2 localhost forwarding (same as the Flow Arrow backend on 8787).
- Optional dev loop: `npm run dev -w bank` with Vite on the same port (stop that compose service first).

## 3. Demo Hub (`http://localhost:3000`)

Purpose: one tab to drive the demo. Flow Arrow is never needed here.

Server (`hub/server.ts`, `node:http`):
- `GET /` -> `public/index.html` (plain HTML/CSS/JS, clean, matches the Flow Arrow palette: navy `#26235C`, yellow `#FFD23F`).
- `GET /api/settings` -> `{ "popups": { "bank": 0.33 }, "defaults": { same } }`
- `PUT /api/settings` body `{ "popups": { ... } }` -> validates each is a number 0..1 (round to 2 decimals), saves to `/data/settings.json`, returns the new settings. 400 on bad input.
- CORS on `/api/*`: `Access-Control-Allow-Origin: *`, methods `GET, PUT, OPTIONS`, header `Content-Type` (the bank app on another port calls it).

UI: title "Flow Arrow Demo Hub", one card (Himal Bank :3001):
- Online/offline dot (ping the app every 5 s with `fetch(url, {mode:"no-cors"})`).
- **Open** -> `window.open("http://localhost:3001/", "flowarrow-bank")`. **Reset** -> `window.open("http://localhost:3001/reset", "flowarrow-bank")`. The named target reuses the same tab.
- Popup chance: label ("'Go paperless?' dialog after each login"), a slider 0.00-1.00 step 0.01, a number box (2 decimals) kept in sync, and quick buttons **Never (0)**, **Default**, **Always (1)**. Saves on change (debounced 300 ms) with a small "Saved" confirmation.
- Footer row: demo login reminder "Demo login: eluu / 1234".

## 4. Popups (random interruptions)

The bank app fetches `http://localhost:3000/api/settings` (800 ms timeout, no cache) at the moment of the roll, falls back to the built-in default if the hub is unreachable, and returns `Math.random() < chance`. `1.00` = always, `0.00` = never.

| App | Popup | Rolled when | Default | Content |
|-----|-------|-------------|---------|---------|
| Bank | "Go paperless?" modal | each successful login, shown on the page the login lands on | 0.33 | Leaf icon, "Go paperless with Himal Bank", short text, buttons **Go paperless** (sets paperless on, toast "You're now paperless.") and **Maybe later**, plus X (aria-label "Close"). Backdrop blocks the page. |

Uses the shared accessible `Modal`. Focus moves into the dialog; Escape closes it.

## 5. Himal Bank (`:3001`) - "cluttered"

Personality: a big traditional bank. Navy `#0B2545` + gold `#E0A526` accents, white cards, dense content. Everything is visible but buried in noise: 7-link top nav, utility bar, promo carousel, rate tables, many similar buttons, huge footer.

### Pages
- `/` (public home): utility bar, main nav (Personal, Business, Loans, Mortgages, Investing, Learn, Help), **sign-in card on the left of the hero** (Username, Password, "Remember me" checkbox, **Sign in** button, "Forgot username or password?" toast, "Enroll" toast), promo carousel (auto-rotates every 6 s, pause button), 4 product tiles, rates table, "Why Himal" section, footer with ~30 links. Header also has a **Sign in** button linking to `/login`.
- `/login`: dedicated sign-in page (same fields). After success go to `next` query param or `/accounts`.
- `/accounts` (auth): "Good afternoon, Edwin" header, **Log out** in the header on every signed-in page, account tiles:
  - Everyday Checking ••4821: available **$2,431.18**
  - Himal Savings ••7730: **$8,905.42**
  - Himal Rewards Visa ••1956: current balance **$642.37**, statement balance **$518.20**, minimum due **$35.00**, due **Oct 12, 2026**, credit limit $5,000.00
  - Quick actions row with deliberately similar buttons: **Transfer**, **Pay bills**, **Pay card**, **Deposit check** (toast), **Send money** (toast), **Statements**
  - Recent activity (last 8 transactions across accounts), right sidebar promos.
- `/accounts/checking`, `/accounts/savings`, `/accounts/card`: balance header + transaction table (date, description, category, amount, running balance) with a search box and a month filter.
- `/pay-card` (auth), 3 steps on separate routes or a stepper:
  1. **Payment details**: card preselected (Himal Rewards Visa ••1956). Amount radios: Statement balance $518.20 / Minimum due $35.00 / Current balance $642.37 / **Other amount** (radio reveals a `$` text field labeled "Other amount"). **Pay from** select starting on "Choose an account" (Everyday Checking ••4821 $2,431.18 / Himal Savings ••7730 $8,905.42). Payment date: "Today" radio (default) or "Pick a date" (date input). **Continue**. Validation errors inline: no account chosen; other amount empty, <= 0, > current balance, or > the chosen account's available balance.
  2. **Review**: summary + **Submit payment** + Back/Edit.
  3. **Confirmation**: check icon, "Payment scheduled", confirmation number `HB-` + 6 random digits, amount, account. Balances update: checking/savings minus amount; card current balance minus amount; statement balance becomes $0.00 if paid >= statement balance. New transactions appear in both accounts' activity.
- `/profile` (auth): contact info (read-only) + Paperless statements toggle.
- Any auth page while logged out -> `/login?next=<path>`; after login you land back on it (this powers the "logged out mid-payment" recovery demo).

### Seed data
Generate ~30 transactions per month for July, August, September 2026 across checking and card with consistent categories and balances. Merchant names are fake but realistic.

### Supported tasks (must all work end to end, EN + NE)
1. **HERO:** Pay the credit card bill (statement balance, minimum, current, or a **custom amount**) from checking or savings, starting logged out. NE: "मेरो क्रेडिट कार्डको बिल तिर्नुहोस्".
2. Check the checking balance (starts logged out; answer is on `/accounts`). NE: "मेरो ब्यालेन्स कति छ?".
3. Turn on paperless statements.
4. Log out / log back in.
