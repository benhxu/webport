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

| Event | What it answers |
| --- | --- |
| `site_loaded` | Which devices, themes, and viewports visit? |
| `section_viewed` | Which sections did visitors reach? |
| `section_dwell` | How long did visitors spend in each section? |
| `scroll_started` | Did a visitor engage beyond the landing view? |
| `scroll_depth` | How far did visitors progress? |
| `nav_clicked` | Which navigation routes are used? |
| `cube_face_viewed` | Which projects appeared on the cube? |
| `cube_face_clicked` | Which cube projects drove deeper exploration? |
| `experience_card_toggled` | Which roles were expanded? |
| `contact_clicked` | Which calls to action drove contact intent? |
| `contact_field_focused` | Where did form engagement begin? |
| `contact_field_completed` | Where did users abandon the form? |
| `contact_form_submitted` | Did submission start, succeed, or fail? |
| `outbound_link_clicked` | Did visitors choose LinkedIn or GitHub? |
| `engagement_heartbeat` | Was the visitor still actively viewing the site? |
| `performance_timing` | How quickly did the page load? |
| `web_vitals` | Did visitors experience layout shift or interaction lag? |
| `client_error` | Did the browser encounter a runtime failure? |

## Suggested Dashboard

Create these PostHog insights:

1. Funnel: `site_loaded` -> `section_viewed: experience` ->
   `contact_clicked` -> `contact_form_submitted: success`.
2. Trend: median `section_dwell.duration_ms`, broken down by section.
3. Trend: `scroll_depth`, broken down by device viewport.
4. Trend: `cube_face_clicked`, broken down by face.
5. Trend: `contact_form_submitted`, broken down by status.
6. Performance: p75 `web_vitals.lcp_ms`, `web_vitals.inp_ms`, and
   `web_vitals.cls`.

No email address, message content, or other form value is included in custom
analytics events.
