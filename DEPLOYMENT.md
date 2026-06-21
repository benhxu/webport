# Deploy Ben Xu's Portfolio

The production setup uses:

- GitHub for source control
- Vercel for the Vite website and `/api/contact`
- Resend for contact-form email delivery
- PostHog for analytics and session replay

### Environment variables

Add these in Vercel under **Project Settings > Environment Variables**:

```text
RESEND_API_KEY                 — from resend.com dashboard
CONTACT_TO_EMAIL               — email address that receives messages
CONTACT_FROM_EMAIL             — Ben Xu Portfolio <onboarding@resend.dev>
CONTACT_ALLOWED_ORIGINS        — https://webport-mu-seven.vercel.app plus custom domain
VITE_CONTACT_FORM_ENDPOINT     — /api/contact
VITE_POSTHOG_KEY               — PostHog project token
VITE_POSTHOG_HOST              — https://us.i.posthog.com
VITE_POSTHOG_SESSION_REPLAY    — false unless you are intentionally reviewing masked session replay
```

Do not paste `RESEND_API_KEY` or `CONTACT_TO_EMAIL` into files committed to GitHub.
Keep `CONTACT_ALLOWED_ORIGINS` comma-separated, with no trailing slash.

## Before launch

1. Run `npm run build`.
2. Test the production contact form after the Vercel environment variables are configured.
3. Confirm PostHog receives `$pageview`, `site_loaded`, `channel_viewed`, and a test interaction.
4. Confirm the deployed response includes the CSP and security headers from `vercel.json`.

The first Resend setup can use `onboarding@resend.dev` when the receiving address
matches the email used for the Resend account. A verified custom domain can replace
that sender later.
