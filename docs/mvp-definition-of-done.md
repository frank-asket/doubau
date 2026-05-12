# MVP Definition of Done — repo alignment

This document maps the target MVP checklist to **what exists in this repository today**. Status values are factual; “Partial” means behavior exists but does not fully meet the bullet without extra work (QA, infra, or product).

| # | Requirement | Status | Evidence / notes |
|---|-------------|--------|-------------------|
| 1 | User can **register**, **upload résumé**, and complete **Career Profile** | **Done** (with env deps) | Clerk signup (`/signup`, `/login`). Résumé: FastAPI `POST /me/resume`, onboarding resume step. Profile: `PUT /me/profile` via onboarding (`/onboarding/*`) and `/api/me/profile` BFF. Requires Clerk JWT template `doubow-api`, API + DB running. |
| 2 | **Job Discovery** shows personalized match feed with **fit scores** | **Partial / Done** | Discovery loads `/jobs/feed` + `/jobs` with embedding-backed similarity scores in feed rows; **AI fit** (score, rationale, gaps) via `POST /jobs/{id}/fit` + `/api/jobs/[jobId]/fit`. Personalization quality depends on résumé embeddings + job index data (verify `DOUBOW_OPENAI_API_KEY` and workers in prod). |
| 3 | User can **track applications** through the full pipeline | **Done** | `ApplicationStatus` state machine (`api/app/state_machine.py`), UI `TrackerClient` + `/applications` APIs; statuses from discovery through approval/submit. |
| 4 | **AI generates outreach drafts** and surfaces them in **Approval Dashboard** | **Done** | `POST .../generate_draft`, drafts list, `/app/approvals` with approve/reject/edit; optional WS `GET ws /applications/ws`. |
| 5 | **No draft can be sent without explicit approval** (verified by penetration test) | **Code: enforced** · **Pentest: external** | Submit (`POST .../submit`) requires **APPROVED** (`assert_transition` in `applications.py`); Celery send runs only after **SUBMITTED** following approval (`dispatch_application_outbound` in `tasks.py`). **Penetration test** is not automated in-repo — schedule manual/API abuse testing against staging. |
| 6 | **Career Copilot** answers career questions with context from user's résumé | **Done** (with env deps) | Copilot LangChain agent (`api/app/agents/copilot_tools.py`) exposes tools using `latest_resume_full_text` / RAG helpers (`retrieve_resume_context_for_role`, etc.). Requires **`DOUBOW_OPENAI_API_KEY`** on API; WS `/copilot/ws`. |
| 7 | **ATS Optimizer** returns keyword match and improvement suggestions | **Done** (with env deps) | Web **`/app/ats-optimizer`** + **`POST /me/jd-fit`** (BFF **`/api/me/jd-fit`**) runs structured fit vs pasted JD using latest parsed résumé; requires **`DOUBOW_OPENAI_API_KEY`**. |
| 8 | **Paid subscription** flow **Standard / Pro / Ultimate** end-to-end | **Partial** | **`/app/billing`** uses Clerk Billing (experimental **`CheckoutButton`** / **`SubscriptionDetailsButton`**) when **`NEXT_PUBLIC_CLERK_PLAN_*`** plan IDs are set in Clerk Dashboard. Optional absolute **`NEXT_PUBLIC_BILLING_CHECKOUT_URL`** redirects with `plan`, `interval`, `source` query params. **Webhook-driven entitlement sync** to FastAPI **`plan_tier`** is still not wired — verify Clerk Billing → your API when you need server-side enforcement. |
| 9 | All **P0 pages** pass **WCAG 2.1 AA** audit | **Not evidenced** | No WCAG audit report or automated accessibility CI (e.g. axe) in repo. Token-based UI exists; **manual/axe audit still required** with a defined P0 route list. |
| 10 | **p95 API response &lt; 300ms** under **500 concurrent users** | **Not evidenced** | No load-test harness (k6, Locust) or performance gate in CI/CD. Requires baseline profiling + infra sizing on Railway/Vercel. |
| 11 | **GDPR deletion** endpoint tested and verified | **Code implemented** · **staging verification required** | FastAPI `DELETE /me/account` deletes résumé S3 objects then deletes the user row so DB cascades remove profile, applications/drafts, milestones, check-ins, match events, idempotency keys, LLM logs, and Copilot sessions. Web settings danger zone calls `/api/me/account`, which then attempts Clerk user deletion with `CLERK_SECRET_KEY`. Integration tests cover the flow when Postgres is available; run against staging before public launch. |

---

## Configuration checklist for demo-ready slices (items 1–6)

**Web (Vercel)**  
`NEXT_PUBLIC_API_BASE_URL`, Clerk **Development** keys for `*.vercel.app`, JWT template **`doubow-api`**.

**API (Railway / Docker)**  
`DOUBOW_DATABASE_URL`, `DOUBOW_JWT_SECRET` / Clerk **`DOUBOW_CLERK_*`**, **`DOUBOW_OPENAI_API_KEY`** for embeddings + Copilot + fit scorer, **`DOUBOW_CORS_ALLOW_ORIGINS`** including your web origin, Celery/Redis if background sends matter.

**Explicit gaps vs MVP definition**  
**8** is **partial** (billing UI + Clerk Checkout; server-side plan enforcement via webhook still needed). Items **7**, **9–11** remain open until implemented and verified.
