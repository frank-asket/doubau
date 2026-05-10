# Phase 4 implementation matrix

This document maps the Phase 4 roadmap bullets to concrete behavior in the repo.

## Design system

| Requirement | Implementation |
|-------------|----------------|
| Navy sidebar `#0F1117`, white content | `.theme-app` tokens in `src/styles/app-theme.css` |
| Accent `#4F8EF7` | `--app-accent`, blue scale, focus rings |
| **shadcn/ui** | `components.json`, `clsx` + `tailwind-merge` + `cn()` (shadcn pattern), Radix slot dependency for future primitives, `components/ui/textarea.tsx` (token-mapped) |

## Data & client state

| Requirement | Implementation |
|-------------|----------------|
| TanStack Query | `AppProviders` + shared `queryKeys` + `/api` BFF routes |
| Zustand | `src/stores/app-ui.ts` (extend for filters / composer overrides) |

## Approval dashboard

| Requirement | Implementation |
|-------------|----------------|
| Inline edit | **Edit** toggles `Textarea`; **Save** → `PATCH /api/applications/drafts/[draftId]` → FastAPI `PATCH /applications/drafts/{draft_id}` |
| Approve → APPROVED | Existing POST approve |
| Reject | Existing POST reject |
| Real-time via WebSocket | FastAPI `GET ws /applications/ws` (JWT query token); signature polls pipeline every 2s; emits `applications_changed`. Web uses `useApplicationsPipelineWs` → invalidates queries. **Backup**: 60s TanStack refetch. |

## Route coverage (P1 / P2)

Scaffold pages live under `/app/*` with `PhaseLaunchPlaceholder`. **Settings & billing** documents Stripe env hooks for API wiring.

## Production checklist

1. Run **FastAPI** with the same `NEXT_PUBLIC_API_BASE_URL` the web app uses.
2. Clerk **JWT template `doubow-api`** aligned with API JWKS/audience.
3. For Stripe: configure API secrets + webhook; then add Checkout triggers from `/app/settings`.
