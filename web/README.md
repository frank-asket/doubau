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
