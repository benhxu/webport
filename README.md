# Ben Xu Portfolio

**Live site:** https://webport-mu-seven.vercel.app/

A quiet editorial one-page portfolio for Ben Xu. The design is intentionally
simple: a strong positioning hero, concise proof, selected work, operating
philosophy, and a direct contact form.

- **Hero:** positioning, value proposition, and primary calls to action
- **Proof:** three context-rich outcome points
- **Selected Work:** Marlo.Today and FreeWire Technologies case-study rows
- **About:** profile, background, education, and operating perspective
- **Contact:** short form plus LinkedIn, GitHub, and email shortcuts

## Stack

| Layer | Tool |
| --- | --- |
| Build | Vite 8 + TypeScript 5.8 |
| UI | Static HTML, CSS, and vanilla TypeScript |
| Motion | Native CSS transitions and browser scrolling |
| Email | Vercel serverless function at `/api/contact` plus Resend |
| Analytics | PostHog custom events, optional session replay, optional custom beacon endpoint |
| Hosting | Vercel |

No React, no CSS framework, and no runtime content CMS. The visible content lives
in `index.html`, durable copy lives in `src/content/siteContent.ts`, interaction
and analytics live in `src/main.ts`, and styling lives in `src/styles.css`.

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
    content/
      siteContent.ts Durable portfolio copy and analytics section names
    main.ts          Navigation state, analytics, performance tracking, form handling
    styles.css       Editorial styling and responsive behavior
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
