# Ben Xu Portfolio

A Vite + TypeScript portfolio presented as a premium four-section signal interface:

- **Home:** messy operational signals resolve into a clear value proposition
- **About:** background, operating perspective, and profile facts
- **Experience:** proof-first systems/case studies for Marlo.Today and FreeWire Technologies
- **Contact:** simple form, direct email fallback, and social links

Production services:

- Vercel for hosting and `/api/contact`
- Resend for contact email delivery
- PostHog for analytics and optional session replay

Primary content now lives in `src/content/siteContent.ts` so copy and proof
points can be updated without digging through rendering logic.

## Local development

```bash
npm install
npm run dev
```

## Production check

```bash
npm run build
npm run preview
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [ANALYTICS.md](./ANALYTICS.md) for
environment variables and launch checks.
