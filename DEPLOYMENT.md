# Deploy Ben Xu's Portfolio

The production setup uses:

- GitHub for source control
- Vercel for the static Vite website
- Formspree for contact-form email delivery
- PostHog for explicit custom analytics events

## Environment Variables

Add these in Vercel under **Project Settings > Environment Variables**:

```text
VITE_POSTHOG_KEY            — PostHog project token
VITE_POSTHOG_HOST           — https://us.i.posthog.com
```

The Formspree endpoint is public. The receiving inbox is configured in
Formspree, not in Vercel.

## Before Launch

1. Run `npm run build`.
2. Run `npm run check:ship`.
3. Test the production contact form after the Formspree endpoint is confirmed.
4. Confirm PostHog receives `$pageview`, `site_loaded`, `section_viewed`, and a test interaction.
5. Confirm the deployed response includes the CSP and security headers from `vercel.json`.
6. Confirm the contact form does not expose visitor form values in PostHog, Vercel logs, or browser console output.
7. Run `npm run smoke:prod` after deploy.

## Post-Deploy Smoke Tests

The automated smoke test confirms the deployed page, global security headers,
Formspree CSP allowances, and that the page no longer references `/api/contact`:

```bash
npm run smoke:prod
```

Expected: the command passes and skips actual email delivery.

Run one explicit delivery smoke test when you want to send a real test message
through Formspree:

```bash
SMOKE_SEND_EMAIL=true npm run smoke:prod
```

Expected: the command passes and one test submission appears in Formspree or
arrives in the configured inbox.

Use another deployed target with:

```bash
SMOKE_BASE_URL=https://your-custom-domain.example npm run smoke:prod
```

Use a different Formspree endpoint with:

```bash
SMOKE_FORMSPREE_ENDPOINT=https://formspree.io/f/your-id npm run smoke:prod
```

## Custom Domains

If you change domains later:

1. Add the custom domain in Vercel.
2. Update `og:url`, canonical URL, and any public docs that mention the old Vercel URL.
3. Keep the Formspree endpoint the same unless you create a new Formspree form.
4. Run `SMOKE_BASE_URL=https://your-domain.example npm run smoke:prod`.
