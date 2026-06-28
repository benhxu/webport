# Security

This document describes the current security posture for the portfolio.

## Secrets Management

The production site is a static Vite app on Vercel. It does not store Resend,
Supabase, Upstash, database, or server-side email credentials in this repo.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_POSTHOG_KEY` | Browser | Public PostHog project token |
| `VITE_POSTHOG_HOST` | Browser | PostHog ingest host |

Only variables prefixed with `VITE_` are exposed to the browser bundle. These
values are public by design. The Formspree endpoint is wired directly into the
form, while the destination inbox and spam controls are managed in the Formspree
dashboard.

If a private provider token is accidentally committed in the future, revoke it in
the provider dashboard, create a replacement, update Vercel, and remove the
leaked value from git history.

## Contact Form Protections

The contact form submits to Formspree and includes:

| Protection | Current behavior |
| --- | --- |
| Browser validation | Requires name, email, subject, and message before submission |
| Hidden honeypot | Uses `_gotcha` so obvious bots can be dropped without sending a message |
| Hosted filtering | Formspree handles delivery, spam controls, and destination inbox routing |
| CSP restrictions | `connect-src` and `form-action` allow Formspree explicitly |
| Privacy controls | Form fields use `data-ph-no-capture`; analytics events never include submitted content |
| Error handling | Network or Formspree failures show a generic retry message to visitors |

Because there is no custom contact API in this version, there are no server-side
email secrets, serverless function logs, or Redis rate-limit credentials to
manage. If custom API behavior is reintroduced later, add server-side validation,
origin checks, durable rate limiting, and secret-management documentation before
shipping it.

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
site still loads assets, analytics, and Formspree contact-form requests.

The CSP intentionally omits `'unsafe-inline'`. Hero animation constants live in
data attributes and are applied by the trusted first-party script.

## PostHog Privacy

PostHog is configured to use explicit custom events:

- `autocapture: false` avoids accidental capture of arbitrary page text.
- Session replay and external PostHog dependency loading are disabled.
- The contact form and every contact field use `data-ph-no-capture`.
- No `posthog.identify()` call is used, so anonymous visitors are not tied to a
  known identity by this app.

Custom events intentionally avoid names, emails, subject lines, and message
content.

## Dependency Hygiene

- Run `npm audit` periodically and address high or critical findings.
- Keep Vercel, Formspree, and PostHog credentials scoped to this project.
- Review `package-lock.json` changes before merging dependency updates.

## Vulnerability Reports

This is a personal portfolio with no formal bug bounty program. Report genuine
security issues privately to the site owner rather than opening a public issue
with exploit details.
