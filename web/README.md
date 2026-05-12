This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### If you see 404s on `/_next/static/...` (e.g. `main-app.js`, `layout.css`)

Usually the browser cached HTML from an older dev build while chunk filenames changed. Stop `npm run dev`, delete the `.next` folder, start dev again, then hard-reload the tab (or empty cache). Middleware is configured to skip `/_next` so Next assets are not intercepted.

### Clerk “preloaded but not used” on hosted sign-in pages

Warnings about `ui.browser.js` on `*.clerk.accounts.dev` come from Clerk’s hosted UI; they are harmless and do not affect your app’s own `/_next` bundles.

### Google / LinkedIn sign-in (OAuth)

Enable the providers under Clerk → User & Authentication → Social connections. Your app uses Clerk’s hosted sign-in; no separate NextAuth wiring is required.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

**Demo / `*.vercel.app` (e.g. demo day on `doubau.vercel.app`):** Use Clerk’s **Development** instance keys — **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** (`pk_test_…`) and **`CLERK_SECRET_KEY`** (`sk_test_…`). Add `https://doubau.vercel.app` under Clerk → **Development** → **Domains** (allowed origins / redirects). The browser may warn about “development keys”; that is expected for this setup and fine for a demo.

**Backend:** Set **`NEXT_PUBLIC_API_BASE_URL`** to your public Railway API origin exactly as shown in Railway (HTTPS, no trailing slash), e.g. `https://doubau-production.up.railway.app`. If unset, server-side calls default to `http://localhost:8000` and will fail on Vercel. Optional: **`NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`**.

**Troubleshooting `/api/me/*` or analytics:** Run `curl -sS -o /dev/null -w "%{http_code}" https://<your-api-host>/health` — expect **200**. **502** often means the Railway **HTTP target port** does not match the process (e.g. app on **8080** via `PORT`, but proxy still pointed at **8000**), or the container crashed (see **Deployments → Logs**). **401** on `/me/*` means Clerk JWT template **`doubow-api`** audience must match API **`DOUBOW_CLERK_AUDIENCE`** / JWKS.

**Canonical URL:** On Vercel, metadata/sitemap use **`https://${VERCEL_URL}`** automatically (e.g. `https://doubau.vercel.app`). Set **`NEXT_PUBLIC_SITE_URL`** only if you want a fixed origin (e.g. later `https://doubow.com`).

**Later (custom domain + “real” production):** Clerk **Production** (`pk_live_…` / `sk_live_…`) does **not** support `*.vercel.app`. After you buy a domain, add it in Vercel → **Domains**, then create or switch to a Clerk **Production** app and register that hostname per [Clerk deployments](https://clerk.com/docs/deployments/overview).

**Clerk Billing (optional):** Enable Billing in the Clerk Dashboard and create plans (this project expects **Free** / **Business** — keys **`free_user`** / **`business`**). Web env (see also `/app/billing`):

- **`NEXT_PUBLIC_CLERK_PLAN_FREE_MONTH`** / **`NEXT_PUBLIC_CLERK_PLAN_FREE_YEAR`** — Clerk plan IDs for the Free plan (`cplan_…`).
- **`NEXT_PUBLIC_CLERK_PLAN_BUSINESS_MONTH`** / **`NEXT_PUBLIC_CLERK_PLAN_BUSINESS_YEAR`** — Clerk plan IDs for Business (trial/delay billing is configured in Clerk).
- **Shorthand** when you use a single Clerk price period: **`NEXT_PUBLIC_CLERK_PLAN_FREE`** and **`NEXT_PUBLIC_CLERK_PLAN_BUSINESS`** (same id is used for monthly/yearly checkout until you split env vars).
- **Legacy env names** (`NEXT_PUBLIC_CLERK_PLAN_STANDARD_*`, **`_PRO_*`**, **`_ULTIMATE_*`**, and shorthand **`_STANDARD`** / **`_PRO`** / **`_ULTIMATE`**) still map to Free / Business for older deployments.
- **`NEXT_PUBLIC_BILLING_CHECKOUT_URL`** — default `/app/billing/checkout`; use an absolute **https** URL for Stripe Payment Links or another PSP (query params `plan`, `interval`, `source` are appended).
- **`NEXT_PUBLIC_BILLING_PORTAL_URL`** — default `/app/billing/portal` (Clerk subscription drawer). Success/cancel return URLs: **`/billing?checkout=success`** and **`/billing?checkout=cancel`** redirect to **`/app/billing`**.
