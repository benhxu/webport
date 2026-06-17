# Portfolio Analytics

PostHog is the production analytics provider. The site records channel interest,
active reading time, interaction intent, form conversion, performance, and
runtime errors without capturing contact-form values.

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
| `channel_viewed` | `channel`, `name`, `source` | Which channels are opened, and how did visitors reach them? |
| `channel_dwell` | `channel`, `name`, `duration_ms`, `max_scroll_depth`, `scrolled`, `reason` | How long did visitors actively spend with each channel? |
| `channel_scroll_started` | `channel` | Did a visitor begin reading overflow content? |
| `channel_scroll_depth` | `channel`, `depth_percent` | How far did visitors read inside longer mobile channels? |
| `hero_assembly_completed` | `duration_ms` | Did the signature landing animation finish? |
| `cta_clicked` | `location`, `target_channel` | Which landing CTA generated intent? |
| `ui_clicked` | `channel`, `tag`, `label`, `href`, `id` | What controls and links were used? |
| `email_icon_clicked` | none | Did a visitor choose the prefilled email route? |
| `outbound_link_clicked` | `destination`, `label` | Did visitors choose LinkedIn or GitHub? |
| `contact_form_submitted` | `has_name`, `has_email` | How many visitors attempted to submit? |
| `contact_form_success` | none | How many submissions were accepted by the contact API? |
| `contact_form_error` | `status` | Where are contact attempts failing? |
| `contact_field_focused` | `field` | Where does form engagement begin? |
| `contact_field_completed` | `field`, `has_value` | At which field do visitors abandon? |
| `engagement_heartbeat` | `visible_duration_ms`, `active_channel`, `channel_scroll_depth`, `scrolled` | Was the visitor still actively viewing the site? |
| `page_hidden` / `page_visible` | visibility duration and active channel | How much of a session was genuinely visible? |
| `session_ended` | total and visible duration, final channel | How long did the visit last and where did it end? |
| `performance_timing` | navigation timing and transfer values | How quickly did the page load? |
| `resource_summary` | resource, script, image, and transfer counts | How heavy was the page for the visitor? |
| `web_vitals` | `lcp_ms`, `cls`, `inp_ms`, long-task values | Did visitors experience layout shift or interaction lag? |
| `client_error` | `type` | Did the browser encounter a runtime failure? |

## Suggested Dashboard

1. Funnel: `site_loaded` -> `channel_viewed` with `channel = Experience` ->
   `cta_clicked` or `channel_viewed` with `channel = Contact` ->
   `contact_form_submitted` -> `contact_form_success`.
2. Trend: median `channel_dwell.duration_ms`, broken down by `name`.
3. Funnel: `channel_scroll_depth` at `25` -> `50` -> `75` -> `100`.
4. Trend: `channel_viewed`, broken down by `source`.
5. Trend: `email_icon_clicked` and `outbound_link_clicked`.
6. Trend: `contact_form_error`, broken down by `status`.
7. Performance: p75 `web_vitals.lcp_ms`, `web_vitals.inp_ms`, and
   `web_vitals.cls`, broken down by viewport width.

No email address, message content, form value, or other submitted personal data
is included in custom analytics events.
