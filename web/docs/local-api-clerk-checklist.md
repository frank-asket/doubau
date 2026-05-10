# Local API + Clerk — route checklist

Use this to verify the web app against a **running FastAPI** (`NEXT_PUBLIC_API_BASE_URL`, default `http://localhost:8000`) and **Clerk** with a JWT template named **`doubow-api`** whose audience matches the API’s `DOUBOW_CLERK_AUDIENCE`.

**Baseline**

1. Start API: from `api/`, run your usual `uvicorn` / dev command.
2. Start web: from `web/`, `npm run dev` (Node ≥ 20.9).
3. Web `.env`: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.
4. Clerk JWT template **`doubow-api`** configured; API `.env` has matching JWKS / issuer / audience.

**Legend**

| Symbol | Meaning |
|--------|---------|
| ✅ | Should work when prerequisites are met |
| ⚠️ | Depends on API data / optional integrations |
| 🔧 | Mostly static UI; no backend required |

---

### Marketing (no login)

| Route | Check |
|-------|--------|
| `/` | 🔧 Landing loads; links work. |
| `/features` | 🔧 Page renders. |
| `/pricing` | 🔧 Page renders. |
| `/faq` | 🔧 Page renders. |
| `/security` | 🔧 Page renders. |

---

### Auth

| Route | Check |
|-------|--------|
| `/login` | ✅ Clerk sign-in; success redirects per `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` (default `/app/dashboard`). |
| `/signup` | ✅ Clerk sign-up; redirect to onboarding/app per env. |

---

### Onboarding (signed in)

| Route | Check |
|-------|--------|
| `/onboarding/career` | ✅ `GET/PUT` `/api/me/profile` → API `/me/profile`; saves persona and continues flow. |
| `/onboarding/contact` | ✅ Same profile API pattern (verify in Network tab). |
| `/onboarding/goals` | ✅ Profile/goals persist via API. |
| `/onboarding/plan` | ✅ Completes flow (verify navigation + stored profile). |
| `/onboarding/resume` | ⚠️ Resume upload/list uses `/api/me/resume*` → API; needs API + storage/config as deployed. |

---

### Phase 4 roadmap routes (signed in)

Scaffold UIs (`PhaseLaunchPlaceholder`): verify each loads without errors.

| Route | Phase |
|-------|-------|
| `/app/planner`, `/app/pathfinder`, `/app/career-success`, `/app/ats-optimizer`, `/app/settings` | P1 |
| `/app/cv-builder`, `/app/cover-letter`, `/app/career-health`, `/app/linkedin-analysis`, `/app/salary-benchmark`, `/app/sponsorship-hub`, `/app/discussion` | P2 |

---

### App workspace (signed in; middleware protects `/app`)

| Route | Check |
|-------|--------|
| `/app/dashboard` | ✅ Header shows **email + persona** when `/me/profile` returns 200 with Clerk JWT; resume panel loads via `/api/me/resume*`. Signals card is still illustrative numbers. |
| `/app/analytics` | ⚠️ Match metrics/events from `/api/me/match/*`; empty or error if API/token mismatch — see on-screen message. |
| `/app/discovery` | ⚠️ Jobs/feed from API; needs ingested jobs or empty state. |
| `/app/tracker` | ✅ Applications list from `/api/applications` when API + DB have rows. |
| `/app/approvals` | ✅ Drafts + approve/reject/submit/demo against API; inline **edit** still placeholder. |
| `/app/copilot` | ⚠️ Session `POST` + WebSocket to API `/copilot/ws`; requires API, LLM env, and valid JWT on WS URL. |
| `/app/design-system` | 🔧 Static HTML iframes from `public/`; no API. |

---

### Quick verification commands

- Browser: open DevTools → **Network** while visiting `/app/dashboard` — confirm no failed call to your API origin for profile when signed in.
- If profile stays on “Personalizing…”: confirm **Clerk JWT template** name `doubow-api` and API logs for **401** on `GET /me/profile`.

---

### Known gaps (not blockers for “loads”)

- Approval card on dashboard is still **demo copy**, not live pending approvals.
- Copilot and discovery are highly **environment-dependent** (jobs ingested, LLM keys).
