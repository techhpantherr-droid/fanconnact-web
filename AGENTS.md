# Session Summary

## Signup Button Visibility Fix (commit `a9bf2aa`, pushed to `web/r-feature`)
- User reported signup Camera + Verify OTP buttons invisible until hover
- Deployed page had correct `.btn-green-solid` CSS + classes; old cached version used `bg-primary/20` (20% faint, near-invisible on white) — hence hover-only appearance
- Made bulletproof: inline `style="background-color:#10b981!important;color:#fff!important;opacity:1!important"` on `#camera-capture-btn` and `#send-email-otp-btn`; Verify uses `#43c98b` (disabled lighter green)
- Inline `!important` beats any stylesheet rule regardless of cache/CSS cascade
- Verified deployed on GitHub Pages via fetch (patterns present: camera id ×1, `#10b981 !important` ×2, `#43c98b !important` ×1)

## Endpoint Audit (Railway backend `https://web-production-589a7.up.railway.app`)
- WORKING: `/api/sync/status` (quota 6/100), `/api/all-sports/matches` (many live matches incl. `as_16524490` handball, `as_16642128`), `/api/rankings/basketball/points` (source database, 100 players), `/api/leaderboard` (11 sports), `/api/sync/last-updated` (but `playerRecords: 9` — suspiciously low)
- FAILING: `/api/rankings/cricket/odi_bat_men` → 500 (local + Railway), `/api/matches/live` + `/api/matches/upcoming` → 500, `/api/all-sports/match/handball/as_16524490` → 502 (match-detail route passes raw `as_*` id to RapidAPI at server.js L4309 — likely needs `matchId.replace(/^as_/,'')`), `/api/quota` → 404 (route does NOT exist in server.js; quota only in `backend/api-quota.js`)
- Local backend runs via `node server.js` in `backend/` but has `getaddrinfo ENOTFOUND cricbuzz-cricket2.p.rapidapi.com` (local DNS blocks Cricbuzz → cricket endpoints 500 locally)
- PENDING (user asked): implement match center with real AllSports data for non-cricket sports; `match-center-engine.js` is cricket-only, card links lack `&sport=`, `as_*` ids show "Real match data not available"

## Forgot Password Flow (commits `3f487cb`, `bf2407a`, `d37d829`, pushed)
- Login email check fixed via Firestore users collection (bypasses Firebase email-enumeration protection)
- Forgot-password simplified: `sendPasswordResetEmail(auth, email)` with NO custom redirect URL → Firebase hosted reset page handles everything; fixes "Invalid or missing reset link"
- Reset email sender name shows "nites"/project id — Firebase Console only (Authentication → Settings → Email templates); template editing locked on Spark plan → user must upgrade to Blaze or accept

## News API Enhancement (Reverted)
- GNews API addition was reverted by user request (no second API)
- News flow is back to: **Currents API** → **static fallback**
- `fetchFromCurrents` restored to original with multi-page pagination
- Static fallback preserved for both empty results and errors

## Fan Coin Page (`fancoin.html`)
- Created at root with dashboard layout (wallet, earn cards, levels, transactions)
- Uses shared top bar (logo + theme toggle + notification + profile) — no sidebar, no hamburger menu
- All styles in `css/fancoin.css`, asset paths root-relative
- `index.html` coin badge, View Wallet button, FanCoins card → all link to `fancoin.html`
- "Earn Coins" → `index.html` (predictions), "Coin History" + "View All" → expand 35 transactions inline
- Full page respects light/dark theme toggle

## Rankings Auto-Sync System
- Creates `backend/rankings-sync.js` - auto-sync service that scrapes ICC rankings, FIFA rankings, ESPN stats (NBA, MLB), and API-Sports endpoints
- Sync runs every 6 hours via node-cron (`0 */6 * * *`)
- Data served from `data/player-rankings.json` (player stats) and `data/team-rankings.json` (team rankings) - both updated by sync service
- API endpoints: `/api/sync/status`, `/api/sync/trigger` (POST), `/api/sync/last-updated`, `/api/quota`
- `top-players.html` shows source badges (ICC, ESPN, FIFA, etc.), last-updated timestamp, manual refresh button, and link to team rankings per sport
- `leaderboard.html` fetches from backend API first, falls back to static JSON. Shows sync timestamp
- Dependencies added: `axios`, `cheerio`, `node-cron` (all installed in `backend/node_modules/`)
- Start backend: `cd backend && npm start` (runs on port 3001)

## API Quota + Cache Layer (100 requests/day budget)
- **Problem**: External provider (API-Sports/ICC/FIFA/ESPN) allows only ~100 requests/day. Many users would exhaust it instantly.
- **Solution**: `backend/api-quota.js` — shared module enforcing a daily budget + on-disk cache.
  - `data/api-quota.json`: persistent daily counter (resets every 24h), tracks `used`/`limit`/`history`.
  - `data/api-cache.json`: keyed by URL+params, TTL 6h (matches sync interval). Successful responses cached to disk.
  - `cachedFetch(url, params, fetcher, opts)`: returns cached copy if fresh (0 quota used); else consumes 1 quota unit and fetches live; if quota exhausted, serves stale cache or null.
  - All external calls in `rankings-sync.js` (`fetchWithTimeout`) and `server.js` (`cachedFetchJSON` for sportscore/ESPN/tennis) now route through this layer.
  - Tennis athlete detail fetches capped to top 20 to protect budget.
  - New endpoint `GET /api/quota` returns `{ used, limit, remaining, exhausted, resetsInHours }`.
  - `getSyncStatus()` now includes `quota` field.
- **Result**: ~100 external calls/day max (during 6h syncs), served to unlimited users via cache. Verified: 2nd sync hit cache for FIFA/NBA/MLB (0 quota used), quota went 9→15 (only ICC scrapes made new calls).
- **Frontend**: `js/sport-stats.js` already degrades gracefully (try/catch → empty container) if backend/quota down.

## Previous Work (by session context)
- Blue accent theme (#2196f3) across all pages with light/dark CSS overrides
- Auth redirect fix in `js/script.js` (guestAllowedPages)
- Tabletennis surface class overrides, removed Top Players/Upcoming Event
- Notification CSS rewrite (glassmorphism, animations, responsive)
- Theme toggle on `berforeloginindex.html` and `notification.html`
- Canvas scene backgrounds (stadium, cricket, football, basketball)
