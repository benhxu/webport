# Ben Xu Portfolio

**Live site:** https://webport-mu-seven.vercel.app/

A four-section personal portfolio presented as a BXTV-style signal interface.
The visual idea is simple: scattered operational signals resolve into clarity.

- **Home:** animated signal assembly landing page
- **About:** profile, background, education, and operating perspective
- **Experience:** Marlo.Today and FreeWire Technologies work cards
- **Contact:** short contact form plus LinkedIn, GitHub, and email shortcuts

## Stack

| Layer | Tool |
| --- | --- |
| Build | Vite 8 + TypeScript 5.8 |
| UI | Static HTML, CSS, and vanilla TypeScript |
| Motion | GSAP and Lenis |
| Email | Vercel serverless function at `/api/contact` plus Resend |
| Analytics | PostHog custom events, optional session replay, optional custom beacon endpoint |
| Hosting | Vercel |

No React, no CSS framework, and no runtime content CMS. The visible content for
the current restored design lives in `index.html`; motion, navigation, analytics,
and form handling live in `src/main.ts`; styling lives in `src/styles.css`.

## Project Structure

```text
webport/
  api/
    contact.ts       Serverless contact handler with validation, origin checks, rate limiting, and Resend
  docs/
    QA.md            Release QA checklist
  public/
    favicon.svg
    hero-art.webp
    marlo-logo.svg
    freewire-logo.svg
    og-tv.png
  src/
    main.ts          Broadcast navigation, GSAP motion, analytics, form handling
    styles.css       Site styling and responsive behavior
  index.html         Static portfolio markup and content
  vercel.json        Security headers, CSP, and cache headers
  ANALYTICS.md       PostHog event schema and dashboard ideas
  DEPLOYMENT.md      Vercel, Resend, and PostHog setup
  SECURITY.md        Security posture and operational notes
```

## Local Development

```bash
npm install
npm run dev
```

The dev server usually runs at `http://localhost:5173`.

## Environment Variables

Use `.env.local` locally and Vercel project environment variables in production.
Server-only values must not use the `VITE_` prefix.

```env
VITE_CONTACT_FORM_ENDPOINT=/api/contact
VITE_POSTHOG_KEY=phc_your_project_key
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_POSTHOG_SESSION_REPLAY=false

RESEND_API_KEY=re_your_resend_api_key
CONTACT_TO_EMAIL=your_private_receiving_email@example.com
CONTACT_FROM_EMAIL=Ben Xu Portfolio <onboarding@resend.dev>
CONTACT_ALLOWED_ORIGINS=https://webport-mu-seven.vercel.app
```

## Production Check

```bash
npm run build
npm run preview
```

Before shipping, also run through [docs/QA.md](./docs/QA.md). See
[DEPLOYMENT.md](./DEPLOYMENT.md), [ANALYTICS.md](./ANALYTICS.md), and
[SECURITY.md](./SECURITY.md) for service setup and launch checks.
