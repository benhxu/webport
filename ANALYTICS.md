# Portfolio Analytics

The portfolio contains an analytics event layer, but analytics only reaches a
dashboard after a provider is configured. The recommended provider is PostHog.

## Connect PostHog

1. Create a PostHog project at https://posthog.com/.
2. Copy the web project API key.
3. Create `.env.local` in the project root:

```env
VITE_POSTHOG_KEY=phc_your_project_key
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_POSTHOG_SESSION_REPLAY=false
```

4. Restart the development server or redeploy the site.
5. Open the PostHog project and use:
   - **Activity** for individual events.
   - **Insights** for funnels, trends, and retention.
   - **Web analytics** for traffic and acquisition.
   - **Session replay** only after setting `VITE_POSTHOG_SESSION_REPLAY=true`.

Session replay is disabled by default to reduce runtime overhead. When enabled,
all contact-form fields are masked and the form is excluded from autocapture.

## Useful Events

| Event | Properties | What it answers |
| --- | --- | --- |
| `site_loaded` | `pointer`, `reduced_motion`, `analytics_provider` | Which devices and accessibility preferences visit? |
| `section_viewed` | `section: hero \| experience \| about \| contact` | Which sections did visitors reach at least once? |
| `section_dwell` | `section`, `duration_ms`, `max_ratio`, `reason` | How long did visitors actively spend in each section? |
| `scroll_started` | none | Did a visitor engage beyond the landing view? |
| `scroll_milestone` | `depth: 25 \| 50 \| 75 \| 100` | What percentage of visitors reached each page-depth milestone? |
| `scroll_depth` | `depth_percent` | Legacy-compatible page-depth event for existing insights. |
| `nav_clicked` | `target`, `label` | Which navigation routes are used? |
| `cta_clicked` | `location: nav \| hero \| midpage` | Which CTA placement creates the most contact intent? |
| `contact_clicked` | `location` | Legacy-compatible contact-intent event. |
| `experience_expanded` | `company: marlo \| freewire` | Which role generated enough interest to read more? |
| `experience_card_toggled` | `card`, `expanded` | How often are experience details opened and closed? |
| `experience_card_viewed` | `card` | Which experience cards actually entered the viewport? |
| `contact_form_submitted` | `has_name`, `has_email` | How many visitors attempted to submit, including incomplete attempts? |
| `contact_form_success` | none | How many submissions were accepted by the contact API? |
| `contact_form_error` | `status: number \| network` | Where are contact attempts failing? |
| `contact_field_focused` | `field` | Where does form engagement begin? |
| `contact_field_completed` | `field`, `has_value` | At which form field do visitors abandon? |
| `outbound_link_clicked` | `destination`, `label` | Did visitors choose LinkedIn or another external destination? |
| `engagement_heartbeat` | `visible_duration_ms`, `max_scroll_depth`, `active_section`, `scrolled` | Was the visitor still actively viewing the site? |
| `performance_timing` | navigation timing and transfer values | How quickly did the page load? |
| `resource_summary` | resource, script, image, and transfer counts | How heavy was the page for the visitor? |
| `web_vitals` | `lcp_ms`, `cls`, `inp_ms`, long-task values | Did visitors experience layout shift or interaction lag? |
| `client_error` | `type` | Did the browser encounter a runtime failure? |

## Suggested Dashboard

Create these PostHog insights:

1. Funnel: `site_loaded` -> `section_viewed: experience` ->
   `cta_clicked` -> `contact_form_submitted` -> `contact_form_success`.
2. Trend: median `section_dwell.duration_ms`, broken down by section.
3. Funnel: `scroll_milestone: 25` -> `50` -> `75` -> `100`.
4. Trend: `experience_expanded`, broken down by company.
5. Trend: `cta_clicked`, broken down by location.
6. Trend: `contact_form_error`, broken down by status.
7. Performance: p75 `web_vitals.lcp_ms`, `web_vitals.inp_ms`, and
   `web_vitals.cls`.

No email address, message content, or other form value is included in custom
analytics events.
