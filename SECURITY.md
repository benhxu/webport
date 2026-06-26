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
| `UPSTASH_REDIS_REST_URL` | Server only | Durable Redis-backed contact-form rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Server only | Upstash REST token for the contact-form limiter |
| `CONTACT_ALLOW_MEMORY_RATE_LIMIT` | Server only | Emergency-only override for production rate-limit fallback |
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
| Rate limiting | Allows 5 submissions per IP per hour through Upstash Redis in production |
| Diagnostics | Adds `X-Request-Id` and client-safe `requestId` values so failed submissions can be traced in Vercel logs |
| Error handling | Returns generic client-safe errors and logs server-side details by request ID |

### Rate Limiting Caveat

The durable limiter requires `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` in Vercel. In production, if either variable is
missing or Upstash is temporarily unreachable, the API fails closed with `503`
instead of sending email behind weaker in-memory protection. Local development
still uses a module-scope `Map` fallback. `CONTACT_ALLOW_MEMORY_RATE_LIMIT=true`
exists only as an emergency production override.

## Security Headers

`vercel.json` sets these headers:

| Header | Purpose |
| --- | --- |
| `Content-Security-Policy` | Restricts scripts, connections, forms, frames, media, and assets |
| `X-Frame-Options: DENY` | Helps prevent clickjacking |
| `X-Content-Type-Options: nosniff` | Prevents MIME sniffing |
| `Referrer-Policy: strict-origin-when-cross-origin` | Limits referrer leakage |
| `Permissions-Policy` | Disables unused browser APIs such as camera, mic, geolocation, payment, and USB |
| `Strict-Transport-Security` | Forces HTTPS for repeat visitors |
| `Cross-Origin-Opener-Policy` | Isolates browsing context where possible |
| `Cross-Origin-Resource-Policy` | Prevents other origins from embedding same-origin resources |
| `X-Permitted-Cross-Domain-Policies` | Blocks legacy cross-domain policy files |

Run the production URL through a header scanner after deploy, then confirm the
site still loads fonts, analytics, and contact-form requests.

The CSP intentionally omits `'unsafe-inline'`. Hero animation constants live in
data attributes and are applied by the trusted first-party script.

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
