# Deploy Ben Xu's Portfolio

The production setup uses:

- GitHub for source control
- Vercel for the Vite website and `/api/contact`
- Resend for contact-form email delivery
- PostHog for analytics and session replay

## Required Vercel environment variables

Add these in Vercel under **Project Settings > Environment Variables**:

```text
VITE_POSTHOG_KEY
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_POSTHOG_SESSION_REPLAY=true
RESEND_API_KEY
CONTACT_TO_EMAIL
CONTACT_FROM_EMAIL=Ben Xu Portfolio <onboarding@resend.dev>
```

Do not paste `RESEND_API_KEY` or `CONTACT_TO_EMAIL` into files committed to GitHub.

## Before launch

1. Add the current resume as `public/resume.pdf`.
2. Run `npm run build`.
3. Test the production contact form after the Vercel environment variables are configured.
4. Confirm PostHog receives a page view and a test interaction.

The first Resend setup can use `onboarding@resend.dev` when the receiving address
matches the email used for the Resend account. A verified custom domain can replace
that sender later.
