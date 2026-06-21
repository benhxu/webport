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

## Navigation

| Test | Pass |
| --- | --- |
| BX brand returns to the hero | [ ] |
| Work nav scrolls to Selected Work | [ ] |
| About nav scrolls to About | [ ] |
| Contact nav scrolls to Contact | [ ] |
| Hero "View work" button scrolls to Selected Work | [ ] |
| Hero "Contact" button scrolls to Contact | [ ] |
| Direct hashes work: `#home`, `#work`, `#about`, `#contact` | [ ] |
| Wheel, touch, and keyboard scrolling never trap the user | [ ] |
| Hero signal animation feels smooth and does not flash broken layout | [ ] |

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
| Page keeps a logical heading order from hero to contact | [ ] |

## Contact Form

| Test | Expected | Pass |
| --- | --- | --- |
| Valid submission | Email received through Resend; form clears; success status appears | [ ] |
| Invalid email | Browser validation prevents submission | [ ] |
| Empty required field | Browser validation prevents submission | [ ] |
| Message over 2,000 characters | API returns 400; user sees friendly error | [ ] |
| Hidden `website` honeypot filled | API rejects or UI avoids sending real email | [ ] |
| Submit too quickly after page/form start | API returns friendly retry message | [ ] |
| 6 submissions from same warm instance within 1 hour | 6th returns 429 | [ ] |
| External origin POST | API returns 403 | [ ] |
| Missing Resend env vars | API returns 503 without crashing | [ ] |

Origin-check curl:

```bash
curl -i -X POST https://webport-mu-seven.vercel.app/api/contact \
  -H "Content-Type: application/json" \
  -H "Origin: https://evil.example" \
  -d '{"name":"Test","email":"test@example.com","subject":"Test","message":"Hello","startedAt":1}'
```

Expected: `403`.

## Analytics

Use PostHog Activity, Debugger, or Live events.

| Event | How to trigger | Pass |
| --- | --- | --- |
| `$pageview` | Load the site | [ ] |
| `site_loaded` | Load the site | [ ] |
| `section_viewed` | Scroll between sections | [ ] |
| `section_dwell` | Leave a section after viewing it | [ ] |
| `hero_signal_settled` | Let the landing animation finish | [ ] |
| `cta_clicked` | Click a hero CTA | [ ] |
| `ui_clicked` | Click any button or link | [ ] |
| `outbound_link_clicked` | Open LinkedIn or GitHub | [ ] |
| `contact_form_started` | Focus or type into the contact form | [ ] |
| `contact_form_submitted` | Submit the form | [ ] |
| `contact_form_success` | Submit valid form with Resend configured | [ ] |
| `contact_form_error` | Trigger invalid API response or rate limit | [ ] |
| `contact_field_focused` | Focus a form field | [ ] |
| `contact_field_completed` | Change a form field | [ ] |
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

Also test manually on a phone. The hero animation should feel smooth, normal
scrolling should feel responsive, and the contact form should not jump or resize
awkwardly when the mobile keyboard opens.

## Security Headers

Verify production response headers include:

| Header | Pass |
| --- | --- |
| `Content-Security-Policy` | [ ] |
| `X-Frame-Options: DENY` | [ ] |
| `X-Content-Type-Options: nosniff` | [ ] |
| `Referrer-Policy: strict-origin-when-cross-origin` | [ ] |
| `Permissions-Policy` | [ ] |
| `/api/*` returns `Cache-Control: no-store` | [ ] |
| `/assets/*` returns long-lived immutable cache headers | [ ] |

## Content And Links

| Test | Pass |
| --- | --- |
| Marlo.Today link opens `https://www.marlo.today/` | [ ] |
| FreeWire Technologies link opens `https://www.freewiretech.com/` | [ ] |
| LinkedIn link opens the correct profile | [ ] |
| GitHub link opens the correct profile | [ ] |
| Email icon opens a prefilled mailto draft | [ ] |
| Page title and meta description are correct | [ ] |
| OG image renders in link previews | [ ] |
