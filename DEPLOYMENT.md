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
UPSTASH_REDIS_REST_URL         — Upstash Redis REST URL for durable contact-form rate limiting
UPSTASH_REDIS_REST_TOKEN       — Upstash Redis REST token
CONTACT_ALLOW_MEMORY_RATE_LIMIT — false; emergency-only override if Upstash is down
VITE_CONTACT_FORM_ENDPOINT     — /api/contact
VITE_POSTHOG_KEY               — PostHog project token
VITE_POSTHOG_HOST              — https://us.i.posthog.com
VITE_POSTHOG_SESSION_REPLAY    — false unless you are intentionally reviewing masked session replay
```

Do not paste `RESEND_API_KEY` or `CONTACT_TO_EMAIL` into files committed to GitHub.
Keep `CONTACT_ALLOWED_ORIGINS` comma-separated, with no trailing slash.

## Before launch

1. Run `npm run build`.
2. Run `npm run check:ship`.
3. Test the production contact form after the Vercel environment variables are configured.
4. Confirm PostHog receives `$pageview`, `site_loaded`, `section_viewed`, and a test interaction.
5. Confirm the deployed response includes the CSP and security headers from `vercel.json`.
6. Trigger an invalid-origin contact request and confirm the API returns `403` with an `X-Request-Id`.
7. Confirm contact responses do not expose visitor form values in PostHog, Vercel logs, or browser console output.
8. Run `npm run smoke:prod` after deploy.

## Post-deploy smoke tests

Confirm global API headers and method protection:

```bash
curl -i -X HEAD https://webport-mu-seven.vercel.app/api/contact
```

Expected: `405 Method Not Allowed`, `X-Request-Id`,
`Cross-Origin-Resource-Policy: same-origin`, and the other global security
headers.

Confirm the contact endpoint reaches rate limiting without sending email:

```bash
curl -i -X POST https://webport-mu-seven.vercel.app/api/contact \
  -H "Origin: https://webport-mu-seven.vercel.app" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke Test\",\"email\":\"smoke@example.com\",\"subject\":\"Smoke test\",\"message\":\"This should fail timing before email delivery.\",\"startedAt\":$(date +%s)000}"
```

Expected: `400 Please wait a moment and try again.`, `X-Request-Id`, and
`X-RateLimit-Policy: upstash`. If it says `memory-fallback`, the Upstash Vercel
environment variables are missing or unreachable. If it says `missing-upstash`
or returns `503`, production correctly failed closed because durable rate
limiting is not configured.

The same checks are automated:

```bash
npm run smoke:prod
```

After `RESEND_API_KEY` and `CONTACT_TO_EMAIL` are configured, run one explicit
delivery smoke test:

```bash
SMOKE_SEND_EMAIL=true npm run smoke:prod
```

Expected: the command passes and one test email arrives in the configured
inbox. If it returns `503`, `RESEND_API_KEY` or `CONTACT_TO_EMAIL` is missing in
Vercel, or Resend rejected the sender configuration.

Use another deployed target with:

```bash
SMOKE_BASE_URL=https://your-custom-domain.example npm run smoke:prod
```

The first Resend setup can use `onboarding@resend.dev` when the receiving address
matches the email used for the Resend account. A verified custom domain can replace
that sender later.
