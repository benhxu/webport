# QA Checklist - Ben Xu Portfolio

Run this checklist before production launches and after meaningful visual,
analytics, or contact-form changes.

## Smoke Test

| Test | Pass |
| --- | --- |
| `npm run build` completes with no TypeScript or Vite errors | [ ] |
| Local preview loads without a blank screen | [ ] |
| Production URL returns HTTP 200 | [ ] |
| Browser console has no uncaught runtime errors | [ ] |
| No horizontal scroll at desktop or mobile widths | [ ] |

## Section Navigation

| Test | Pass |
| --- | --- |
| BX brand scrolls to Home | [ ] |
| About nav scrolls to About | [ ] |
| Experience nav scrolls to Experience | [ ] |
| Contact nav scrolls to Contact | [ ] |
| Hero "View work" button scrolls to Experience | [ ] |
| Hero "Contact" button scrolls to Contact | [ ] |
| Direct hashes work: `#home`, `#about`, `#experience`, `#contact` | [ ] |
| Wheel, touch, and keyboard browsing do not trap the user | [ ] |
| Hero assembly feels smooth and reduced-motion visitors see the settled state | [ ] |

## Responsive Layout

| Width | Layout OK | No Overflow | Text Readable | CTAs Usable |
| --- | --- | --- | --- | --- |
| 320px | [ ] | [ ] | [ ] | [ ] |
| 375px | [ ] | [ ] | [ ] | [ ] |
| 430px | [ ] | [ ] | [ ] | [ ] |
| 768px | [ ] | [ ] | [ ] | [ ] |
| 1024px | [ ] | [ ] | [ ] | [ ] |
| 1440px | [ ] | [ ] | [ ] | [ ] |
| 1920px | [ ] | [ ] | [ ] | [ ] |

## Accessibility

| Test | Pass |
| --- | --- |
| Tab order reaches nav, hero CTAs, social links, form fields, and submit button | [ ] |
| Focus ring is visible on every interactive element | [ ] |
| Contact inputs have labels | [ ] |
| Icon-only social links have `aria-label` text | [ ] |
| Color contrast is readable in dark and light mode | [ ] |
| `prefers-reduced-motion: reduce` avoids the heavy hero assembly animation | [ ] |
| Nav links set `aria-current="page"` as sections become active | [ ] |

## Contact Form

| Test | Expected | Pass |
| --- | --- | --- |
| Valid submission | Formspree receives message; form clears; success status appears | [ ] |
| Invalid email | Browser validation prevents submission | [ ] |
| Empty required field | Browser validation prevents submission | [ ] |
| Hidden `_gotcha` honeypot filled | UI avoids sending a real message and shows success | [ ] |
| Network failure or blocked Formspree request | User sees friendly retry message | [ ] |
| Formspree endpoint disabled or invalid | User sees friendly retry message | [ ] |
| Repeated test submissions | Formspree dashboard shows expected spam/rate-limit behavior | [ ] |

Automated production smoke:

```bash
npm run smoke:prod
```

PostHog ingestion smoke, which sends a single `portfolio_qa_smoke` event:

```bash
npm run smoke:analytics
```

Contact delivery smoke, when you intentionally want to send one test message:

```bash
SMOKE_SEND_EMAIL=true npm run smoke:prod
```

## Analytics

Use PostHog Activity, Debugger, or Live events.

| Event | How to trigger | Pass |
| --- | --- | --- |
| `$pageview` | Load the site | [ ] |
| `site_loaded` | Load the site | [ ] |
| `section_viewed` | Navigate between sections | [ ] |
| `section_dwell` | Leave a section after viewing it | [ ] |
| `hero_assembly_completed` | Let the landing animation finish | [ ] |
| `section_link_clicked` | Click a nav link or hero CTA | [ ] |
| `ui_clicked` | Click any button or link | [ ] |
| `outbound_link_clicked` | Open LinkedIn or GitHub | [ ] |
| `contact_form_started` | Focus or type into the contact form | [ ] |
| `contact_form_submitted` | Submit the form | [ ] |
| `contact_form_success` | Submit valid form with Formspree configured | [ ] |
| `contact_form_error` | Trigger network/Formspree failure | [ ] |
| `contact_field_focused` | Focus a form field | [ ] |
| `contact_field_completed` | Change a form field | [ ] |
| `page_scroll_depth` | Scroll to 25%, 50%, 75%, and 100% | [ ] |
| `performance_timing` | Load the site and wait for idle callback | [ ] |
| `resource_summary` | Load the site and wait for idle callback | [ ] |
| `web_vitals` | Leave the page or close the tab | [ ] |

Confirm that no PostHog event contains visitor names, email addresses, subject
lines, or message content.

## Performance

Run Lighthouse in an incognito window against the deployed site.

| Metric | Desktop Target | Mobile Target |
| --- | --- | --- |
| Performance score | 90+ | 70+ |
| Accessibility score | 90+ | 90+ |
| Best Practices score | 90+ | 90+ |
| SEO score | 90+ | 90+ |
| LCP | < 2.5s | < 4.0s |
| CLS | < 0.1 | < 0.1 |
| Total Blocking Time | < 200ms | < 300ms |

Also test manually on a phone. The hero animation should feel smooth, section
navigation should feel responsive, and the contact form should not jump or resize
awkwardly when the mobile keyboard opens.

## Security Headers

Verify production response headers include:

| Header | Pass |
| --- | --- |
| `Content-Security-Policy` | [ ] |
| CSP does not include `'unsafe-inline'` | [ ] |
| `X-Frame-Options: DENY` | [ ] |
| `X-Content-Type-Options: nosniff` | [ ] |
| `Referrer-Policy: strict-origin-when-cross-origin` | [ ] |
| `Permissions-Policy` | [ ] |
| `Strict-Transport-Security` | [ ] |
| `Cross-Origin-Opener-Policy` | [ ] |
| `Cross-Origin-Resource-Policy` | [ ] |
| `/assets/*` returns long-lived immutable cache headers | [ ] |

## Content And Links

| Test | Pass |
| --- | --- |
| LinkedIn link opens the correct profile | [ ] |
| GitHub link opens the correct profile | [ ] |
| Page title and meta description are correct | [ ] |
| OG image renders in link previews | [ ] |
