# Security

This document describes the current security posture for the portfolio.

## Secrets Management

Secrets are managed through environment variables and are not committed to the
repository.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Server only | Sends contact-form email through Resend |
| `CONTACT_TO_EMAIL` | Server only | Receives contact-form messages |
| `CONTACT_FROM_EMAIL` | Server only | Sender identity used by Resend |
| `CONTACT_ALLOWED_ORIGINS` | Server only | Comma-separated list of allowed website origins |
| `VITE_POSTHOG_KEY` | Browser | Public PostHog project token |
| `VITE_POSTHOG_HOST` | Browser | PostHog ingest host |
| `VITE_POSTHOG_SESSION_REPLAY` | Browser | Enables or disables PostHog session replay |

Only variables prefixed with `VITE_` are exposed to the browser bundle. Keep
Resend and contact-delivery settings server-only.

If a secret is accidentally committed, revoke it in the provider dashboard,
create a replacement, update Vercel, and remove the leaked value from git
history.

## Contact Form Protections

The `/api/contact` serverless function includes:

| Protection | Current behavior |
| --- | --- |
| Method guard | Only `POST` is accepted |
| Content type guard | Requires `application/json` |
| Origin allowlist | Requires an allowed `Origin` header in production |
| Payload size guard | Rejects payloads over 10 KB |
| Server-side validation | Validates name, email, subject, and message length |
| Honeypot | Rejects submissions that fill the hidden `website` field |
| Timing check | Rejects submissions posted too quickly after form start |
| Rate limiting | Allows 5 submissions per IP per hour per warm serverless instance |
| Error handling | Returns generic client-safe errors |

### Rate Limiting Caveat

The current limiter uses a module-scope `Map`. This works on warm Vercel
function instances and helps with casual spam, but it is not a durable global
limit because cold starts create fresh memory. If spam becomes a real problem,
move the counter to a shared store such as Upstash Redis.

## Security Headers

`vercel.json` sets these headers:

| Header | Purpose |
| --- | --- |
| `Content-Security-Policy` | Restricts scripts, connections, forms, frames, media, and assets |
| `X-Frame-Options: DENY` | Helps prevent clickjacking |
| `X-Content-Type-Options: nosniff` | Prevents MIME sniffing |
| `Referrer-Policy: strict-origin-when-cross-origin` | Limits referrer leakage |
| `Permissions-Policy` | Disables unused browser APIs such as camera, mic, geolocation, payment, and USB |

Run the production URL through a header scanner after deploy, then confirm the
site still loads fonts, analytics, and contact-form requests.

## PostHog Privacy

PostHog is configured to use explicit custom events:

- `autocapture: false` avoids accidental capture of arbitrary page text.
- Session replay is disabled unless `VITE_POSTHOG_SESSION_REPLAY=true`.
- Session replay masks all inputs when enabled.
- The contact form and every contact field use `data-ph-no-capture`.
- No `posthog.identify()` call is used, so anonymous visitors are not tied to a
  known identity by this app.

Custom events intentionally avoid names, emails, subject lines, and message
content.

## Dependency Hygiene

- Run `npm audit` periodically and address high or critical findings.
- Keep Vercel, Resend, and PostHog credentials scoped to this project.
- Review `package-lock.json` changes before merging dependency updates.

## Vulnerability Reports

This is a personal portfolio with no formal bug bounty program. Report genuine
security issues privately to the site owner rather than opening a public issue
with exploit details.
