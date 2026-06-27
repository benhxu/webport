# Portfolio Analytics

PostHog is the production analytics provider. The site records section interest,
active reading time, interaction intent, form conversion, performance, and
runtime errors without capturing contact-form values. PostHog autocapture is
disabled; the app only sends explicit custom events.

## Connect PostHog

Add these environment variables locally and in Vercel:

```env
VITE_POSTHOG_KEY=phc_your_project_key
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_POSTHOG_SESSION_REPLAY=false
```

Restart the development server or redeploy after changing them. In PostHog, use:

- **Activity** for individual events.
- **Insights** for funnels, trends, and retention.
- **Web analytics** for traffic and acquisition.
- **Session replay** after setting `VITE_POSTHOG_SESSION_REPLAY=true`.

Session replay masks every form input and excludes `.contact-inbox` text.

## Useful Events

| Event | Properties | What it answers |
| --- | --- | --- |
| `site_loaded` | `pointer`, `reduced_motion`, `analytics_provider` | Which devices and accessibility preferences visit? |
| `section_viewed` | `section_id`, `section_name`, `source` | Which sections are viewed, and how did visitors reach them? |
| `section_dwell` | `section_id`, `section_name`, `duration_ms`, `reason` | How long did visitors actively spend in each section? |
| `section_link_clicked` | `target_section`, `label` | Which navigation or CTA links create intent? |
| `page_scroll_depth` | `depth_percent`, `active_section` | How far down the overall page did visitors scroll? |
| `hero_assembly_completed` | `duration_ms` | Did the signature landing animation finish? |
| `ui_clicked` | `active_section`, `tag`, `label`, `href`, `id` | What controls and links were used? |
| `outbound_link_clicked` | `destination`, `label` | Did visitors choose LinkedIn or GitHub? |
| `contact_form_started` | none | Did a visitor begin engaging with the contact form? |
| `contact_form_submitted` | `has_name`, `has_email`, `provider` | How many visitors attempted to submit? |
| `contact_form_success` | `provider` | How many submissions were accepted by Formspree? |
| `contact_form_error` | `status`, `provider` | Where are contact attempts failing? |
| `contact_field_focused` | `field` | Where does form engagement begin? |
| `contact_field_completed` | `field`, `has_value` | At which field do visitors abandon? |
| `engagement_heartbeat` | `visible_duration_ms`, `active_section`, `max_scroll_depth`, `section_duration_ms` | Was the visitor still actively viewing the site? |
| `page_hidden` / `page_visible` | visibility duration and active section | How much of a session was genuinely visible? |
| `session_ended` | total and visible duration, final section | How long did the visit last and where did it end? |
| `performance_context` | hardware and low-power context | What kind of device did the visitor use? |
| `performance_timing` | navigation timing and transfer values | How quickly did the page load? |
| `resource_summary` | resource, script, image, stylesheet, and transfer counts | How heavy was the page for the visitor? |
| `web_vitals` | `lcp_ms`, `cls`, `inp_ms`, long-task values | Did visitors experience layout shift or interaction lag? |
| `client_error` | `type`, bounded error details and source location | Did the browser encounter a runtime failure, and where? |
| `color_scheme_changed` | `color_scheme` | Did the visitor's system color preference change during the session? |

## Suggested Dashboard

1. Funnel: `site_loaded` -> `section_viewed` with `section_id = experience` ->
   `section_link_clicked` or `section_viewed` with `section_id = contact` ->
   `contact_form_submitted` -> `contact_form_success`.
2. Trend: median `section_dwell.duration_ms`, broken down by `section_name`.
3. Funnel: `page_scroll_depth` at `25` -> `50` -> `75` -> `100`.
4. Trend: `section_viewed`, broken down by `source`.
5. Trend: `outbound_link_clicked`, broken down by `destination`.
6. Trend: `contact_form_error`, broken down by `status`.
7. Performance: p75 `web_vitals.lcp_ms`, `web_vitals.inp_ms`, and
   `web_vitals.cls`, broken down by viewport width.

No email address, message content, form value, or other submitted personal data
is included in custom analytics events.
