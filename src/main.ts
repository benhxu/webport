import { siteContent } from "./content/siteContent";

const CONTACT_FORM_ENDPOINT = import.meta.env.VITE_CONTACT_FORM_ENDPOINT ?? "/api/contact";
const ANALYTICS_ENDPOINT = import.meta.env.VITE_ANALYTICS_ENDPOINT ?? "";
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY ?? "";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";
const POSTHOG_SESSION_REPLAY = import.meta.env.VITE_POSTHOG_SESSION_REPLAY === "true";
const DEBUG_MODE = new URLSearchParams(window.location.search).get("debug") === "true";
const sessionStartedAt = performance.now();
const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: light)");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const sectionDefinitions = siteContent.sections;
const knownSectionIds = new Set<string>(sectionDefinitions.map((section) => section.id));
const getHashSectionId = () => {
  const sectionId = window.location.hash.replace(/^#/, "");
  return knownSectionIds.has(sectionId) ? sectionId : null;
};
const initialActiveSectionId = getHashSectionId() ?? "home";

type TrackPayload = Record<string, string | number | boolean | null>;
type DebugValue = string | number | boolean | null;

declare global {
  interface Window {
    posthog?: {
      capture: (eventName: string, payload?: TrackPayload) => void;
    };
  }
}

const sessionId = (() => {
  const storageKey = "ben_xu_portfolio_session_id";
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const nextId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem(storageKey, nextId);
  return nextId;
})();

const computeLowPowerMode = () => {
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  const hardwareConcurrency = navigator.hardwareConcurrency || 8;
  const deviceMemory = "deviceMemory" in navigator
    ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0)
    : 0;
  return (
    isMobile ||
    reducedMotionQuery.matches ||
    hardwareConcurrency <= 4 ||
    (deviceMemory > 0 && deviceMemory <= 4)
  );
};

const debugMetrics: Record<string, DebugValue> = {
  low_power_mode: computeLowPowerMode(),
  active_section: initialActiveSectionId,
  max_scroll_depth: "0%",
  errors: 0,
};
let debugPanel: HTMLElement | null = null;

const renderDebugPanel = () => {
  if (!DEBUG_MODE) return;
  if (!debugPanel) {
    debugPanel = document.createElement("aside");
    debugPanel.className = "debug-panel";
    debugPanel.setAttribute("aria-label", "Portfolio performance debug panel");
    document.body.append(debugPanel);
  }
  const rows = Object.entries(debugMetrics)
    .map(([key, value]) => `<span>${key}</span><b>${String(value ?? "-")}</b>`)
    .join("");
  debugPanel.innerHTML = `<strong>Portfolio HUD</strong>${rows}`;
};

const updateDebugMetric = (key: string, value: DebugValue) => {
  debugMetrics[key] = value;
  renderDebugPanel();
};

renderDebugPanel();

const getAnalyticsProviderName = () => {
  if (POSTHOG_KEY) return "posthog";
  if (ANALYTICS_ENDPOINT) return "custom_endpoint";
  return "none";
};

const buildAnalyticsPayload = (eventName: string, payload: TrackPayload = {}) => ({
  event: eventName,
  session_id: sessionId,
  timestamp: new Date().toISOString(),
  elapsed_ms: Math.round(performance.now() - sessionStartedAt),
  path: window.location.pathname,
  hash: window.location.hash || null,
  referrer: document.referrer || null,
  viewport_width: window.innerWidth,
  viewport_height: window.innerHeight,
  screen_width: window.screen.width,
  screen_height: window.screen.height,
  color_scheme: colorSchemeQuery.matches ? "light" : "dark",
  low_power_mode: computeLowPowerMode(),
  ...payload,
});

const pendingAnalyticsEvents: Array<{ eventName: string; payload: TrackPayload }> = [];

const track = (eventName: string, payload: TrackPayload = {}) => {
  const analyticsPayload = buildAnalyticsPayload(eventName, payload);

  if (DEBUG_MODE) {
    console.info("[portfolio:event]", eventName, analyticsPayload);
  }

  try {
    if (window.posthog) {
      window.posthog.capture(eventName, analyticsPayload);
    } else if (POSTHOG_KEY && pendingAnalyticsEvents.length < 200) {
      pendingAnalyticsEvents.push({ eventName, payload: analyticsPayload });
    }
  } catch (error) {
    if (DEBUG_MODE) console.warn("[portfolio:analytics]", error);
  }

  if (!ANALYTICS_ENDPOINT) return;

  try {
    const body = JSON.stringify(analyticsPayload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ANALYTICS_ENDPOINT, blob)) return;
    }
    void fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch (error) {
    if (DEBUG_MODE) console.warn("[portfolio:analytics-endpoint]", error);
  }
};

const initAnalyticsProvider = async () => {
  if (!POSTHOG_KEY) {
    updateDebugMetric("analytics", ANALYTICS_ENDPOINT ? "custom endpoint" : "not configured");
    return;
  }

  try {
    const { default: posthog } = await import("posthog-js");
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false,
      debug: DEBUG_MODE,
      disable_session_recording: !POSTHOG_SESSION_REPLAY,
      person_profiles: "identified_only",
      persistence: "localStorage+cookie",
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: ".contact-inbox",
      },
    });
    window.posthog = posthog;
    pendingAnalyticsEvents.splice(0).forEach(({ eventName, payload }) => {
      posthog.capture(eventName, payload);
    });
    updateDebugMetric("analytics", "posthog ready");
    track("analytics_provider_ready", {
      provider: "posthog",
      session_recording: POSTHOG_SESSION_REPLAY,
    });
  } catch (error) {
    updateDebugMetric("analytics", "failed");
    if (DEBUG_MODE) console.warn("[portfolio:posthog]", error);
  }
};

const scheduleIdle = (callback: () => void, timeout = 500) => {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout });
    return;
  }
  globalThis.setTimeout(callback, timeout);
};

const sectionName = (sectionId: string) =>
  sectionDefinitions.find((section) => section.id === sectionId)?.name ?? sectionId;

const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".site-nav a"));
const observedSections = Array.from(document.querySelectorAll<HTMLElement>(".section-observed"));
const header = document.querySelector<HTMLElement>("[data-site-header]");
let activeSectionId = initialActiveSectionId;
let activeSectionStartedAt = performance.now();
let maxScrollDepth = 0;
const trackedScrollMilestones = new Set<number>();

const updateActiveNav = (sectionId: string) => {
  navLinks.forEach((link) => {
    const isActive = link.hash === `#${sectionId}`;
    link.classList.toggle("is-active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
};

const flushSectionDwell = (reason: string) => {
  const durationMs = Math.round(performance.now() - activeSectionStartedAt);
  track("section_dwell", {
    section: activeSectionId,
    name: sectionName(activeSectionId),
    duration_ms: durationMs,
    max_scroll_depth: maxScrollDepth,
    reason,
  });
  activeSectionStartedAt = performance.now();
};

const setActiveSection = (sectionId: string, source: string) => {
  if (activeSectionId === sectionId) return;
  flushSectionDwell("section_change");
  activeSectionId = sectionId;
  activeSectionStartedAt = performance.now();
  updateActiveNav(sectionId);
  updateDebugMetric("active_section", sectionId);
  track("section_viewed", {
    section: sectionId,
    name: sectionName(sectionId),
    source,
  });
};

const initSectionTracking = () => {
  updateActiveNav(activeSectionId);
  track("section_viewed", {
    section: activeSectionId,
    name: sectionName(activeSectionId),
    source: window.location.hash ? "hash" : "load",
  });

  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.38)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visibleEntry) return;
      const section = visibleEntry.target as HTMLElement;
      setActiveSection(section.id || section.dataset.sectionName || "unknown", "scroll");
    },
    {
      rootMargin: "-24% 0px -52% 0px",
      threshold: [0.38, 0.52, 0.7],
    },
  );

  observedSections.forEach((section) => observer.observe(section));
};

let scrollQueued = false;
const updateScrollAnalytics = () => {
  scrollQueued = false;
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const depth = scrollable <= 0
    ? 100
    : Math.min(100, Math.round((window.scrollY / scrollable) * 100));
  if (depth <= maxScrollDepth) return;
  maxScrollDepth = depth;
  updateDebugMetric("max_scroll_depth", `${depth}%`);
  [25, 50, 75, 100].forEach((milestone) => {
    if (depth < milestone || trackedScrollMilestones.has(milestone)) return;
    trackedScrollMilestones.add(milestone);
    track("scroll_depth_reached", {
      depth_percent: milestone,
      active_section: activeSectionId,
    });
  });
};

window.addEventListener(
  "scroll",
  () => {
    header?.classList.toggle("is-scrolled", window.scrollY > 6);
    if (scrollQueued) return;
    scrollQueued = true;
    window.requestAnimationFrame(updateScrollAnalytics);
  },
  { passive: true },
);
header?.classList.toggle("is-scrolled", window.scrollY > 6);

window.addEventListener("hashchange", () => {
  const hashSectionId = getHashSectionId();
  if (hashSectionId) setActiveSection(hashSectionId, "hash");
});

document.querySelectorAll<HTMLElement>("[data-cta]").forEach((control) => {
  control.addEventListener("click", () => {
    track("cta_clicked", {
      location: "hero",
      label: control.dataset.cta ?? "unknown",
    });
  });
});

const initContactForm = () => {
  const form = document.querySelector<HTMLFormElement>("[data-contact-form]");
  const status = document.querySelector<HTMLElement>("[data-contact-status]");
  const submitButton = document.querySelector<HTMLButtonElement>("[data-contact-submit]");
  const startedAtField = form?.querySelector<HTMLInputElement>("[name=\"startedAt\"]");
  if (!form || !status || !submitButton) return;

  const resetStartedAt = () => {
    if (startedAtField) startedAtField.value = String(Date.now());
  };
  let formStartTracked = false;

  const markFormStarted = () => {
    if (formStartTracked) return;
    formStartTracked = true;
    resetStartedAt();
    track("contact_form_started");
  };

  const setStatus = (message: string, type: "idle" | "success" | "error" = "idle") => {
    status.textContent = message;
    status.classList.remove("is-success", "is-error");
    if (type === "success") status.classList.add("is-success");
    if (type === "error") status.classList.add("is-error");
  };

  form.addEventListener("focusin", markFormStarted, { once: true });
  form.addEventListener("input", markFormStarted, { once: true });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!startedAtField?.value) resetStartedAt();
    const formData = new FormData(form);
    track("contact_form_submitted", {
      has_name: Boolean(String(formData.get("name") ?? "").trim()),
      has_email: Boolean(String(formData.get("email") ?? "").trim()),
    });

    if (!form.checkValidity()) {
      form.reportValidity();
      setStatus("Please complete the required fields.", "error");
      track("contact_form_error", { status: "validation" });
      return;
    }

    if (String(formData.get("website") ?? "").trim()) {
      form.reset();
      resetStartedAt();
      setStatus("Message sent - I will be in touch soon.", "success");
      return;
    }

    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      message: String(formData.get("message") ?? ""),
      website: String(formData.get("website") ?? ""),
      startedAt: Number(formData.get("startedAt") ?? 0),
    };

    submitButton.disabled = true;
    form.setAttribute("aria-busy", "true");
    setStatus("Sending...");

    try {
      const controller = new AbortController();
      const timeoutId = globalThis.setTimeout(() => controller.abort(), 12_000);
      const response = await fetch(CONTACT_FORM_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      }).finally(() => globalThis.clearTimeout(timeoutId));

      const responseBody = await response.json().catch(() => null);
      if (!response.ok || responseBody?.ok !== true) {
        const requestError = new Error(responseBody?.error || "Form submission failed") as Error & {
          status?: number;
        };
        requestError.status = response.status;
        throw requestError;
      }

      form.reset();
      resetStartedAt();
      setStatus("Message received - thanks.", "success");
      track("contact_form_success");
    } catch (error) {
      const statusCode: string | number = error instanceof Error && "status" in error
        ? Number((error as Error & { status?: number }).status) || "network"
        : "network";
      setStatus("Something interrupted the send. Please try again.", "error");
      track("contact_form_error", { status: statusCode });
    } finally {
      submitButton.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });
};

initContactForm();

document.querySelector<HTMLAnchorElement>("[data-email-link]")?.addEventListener("click", () => {
  track("email_icon_clicked");
});

const focusedContactFields = new Set<string>();

document.addEventListener("focusin", (event) => {
  const field = (event.target as Element | null)?.closest<HTMLInputElement | HTMLTextAreaElement>(
    ".contact-inbox input, .contact-inbox textarea",
  );
  if (!field || field.name === "website" || field.type === "hidden" || focusedContactFields.has(field.name)) return;
  focusedContactFields.add(field.name);
  track("contact_field_focused", { field: field.name });
});

document.addEventListener("change", (event) => {
  const field = (event.target as Element | null)?.closest<HTMLInputElement | HTMLTextAreaElement>(
    ".contact-inbox input, .contact-inbox textarea",
  );
  if (!field || field.name === "website" || field.type === "hidden") return;
  track("contact_field_completed", {
    field: field.name,
    has_value: Boolean(field.value.trim()),
  });
});

document.addEventListener(
  "click",
  (event) => {
    const target = event.target as Element | null;
    const action = target?.closest<HTMLElement>("a, button, [role='button']");
    if (!action) return;
    const label =
      action.getAttribute("aria-label") ||
      action.textContent?.replace(/\s+/g, " ").trim() ||
      action.id ||
      "unlabeled";
    track("ui_clicked", {
      active_section: activeSectionId,
      tag: action.tagName.toLowerCase(),
      label: label.slice(0, 96),
      href: action instanceof HTMLAnchorElement ? action.href : null,
      id: action.id || null,
    });
  },
  { capture: true },
);

document.addEventListener("click", (event) => {
  const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[target='_blank']");
  if (!link) return;
  track("outbound_link_clicked", {
    destination: link.hostname,
    label: link.getAttribute("aria-label") || link.textContent?.trim() || null,
  });
});

colorSchemeQuery.addEventListener("change", (event) => {
  updateDebugMetric("color_scheme", event.matches ? "light" : "dark");
  track("color_scheme_changed", {
    color_scheme: event.matches ? "light" : "dark",
  });
});

window.addEventListener("error", () => {
  updateDebugMetric("errors", Number(debugMetrics.errors || 0) + 1);
  track("client_error", { type: "error" });
});

window.addEventListener("unhandledrejection", () => {
  updateDebugMetric("errors", Number(debugMetrics.errors || 0) + 1);
  track("client_error", { type: "unhandledrejection" });
});

const initPerformanceAnalytics = () => {
  if (!("PerformanceObserver" in window)) return;

  let largestContentfulPaint = 0;
  let cumulativeLayoutShift = 0;
  let interactionLatency = 0;
  let longTaskCount = 0;
  let longTaskDuration = 0;
  const supported = PerformanceObserver.supportedEntryTypes ?? [];

  if (supported.includes("largest-contentful-paint")) {
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        largestContentfulPaint = Math.max(largestContentfulPaint, entry.startTime);
      });
    }).observe({ type: "largest-contentful-paint", buffered: true });
  }

  if (supported.includes("layout-shift")) {
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!shift.hadRecentInput) cumulativeLayoutShift += shift.value ?? 0;
      });
    }).observe({ type: "layout-shift", buffered: true });
  }

  if (supported.includes("event")) {
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        interactionLatency = Math.max(interactionLatency, entry.duration);
      });
    }).observe({ type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
  }

  if (supported.includes("longtask")) {
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        longTaskCount += 1;
        longTaskDuration += entry.duration;
      });
    }).observe({ type: "longtask", buffered: true });
  }

  window.addEventListener(
    "pagehide",
    () => {
      track("web_vitals", {
        lcp_ms: Math.round(largestContentfulPaint),
        cls: Number(cumulativeLayoutShift.toFixed(4)),
        inp_ms: Math.round(interactionLatency),
        long_task_count: longTaskCount,
        long_task_duration_ms: Math.round(longTaskDuration),
      });
    },
    { once: true },
  );
};

initPerformanceAnalytics();

const trackLoadPerformance = () => {
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;

  if (navigation) {
    track("performance_timing", {
      dom_content_loaded_ms: Math.round(
        navigation.domContentLoadedEventEnd - navigation.startTime,
      ),
      load_event_ms: Math.round(navigation.loadEventEnd - navigation.startTime),
      response_end_ms: Math.round(navigation.responseEnd - navigation.startTime),
      transfer_size: navigation.transferSize || 0,
      encoded_body_size: navigation.encodedBodySize || 0,
    });
  }

  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const scripts = resources.filter((resource) => resource.initiatorType === "script");
  const styles = resources.filter((resource) => resource.initiatorType === "link" || resource.initiatorType === "css");
  const images = resources.filter((resource) => resource.initiatorType === "img");
  const fonts = resources.filter((resource) => resource.name.includes("fonts.gstatic.com"));
  const totalTransfer = resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0);

  track("resource_summary", {
    resource_count: resources.length,
    script_count: scripts.length,
    stylesheet_count: styles.length,
    image_count: images.length,
    font_count: fonts.length,
    transfer_size: Math.round(totalTransfer),
  });
};

let visibleStartedAt: number | null =
  document.visibilityState === "visible" ? performance.now() : null;
let visibleDurationMs = 0;

const pauseVisibleTimer = () => {
  if (visibleStartedAt === null) return;
  visibleDurationMs += performance.now() - visibleStartedAt;
  visibleStartedAt = null;
};

const getVisibleDurationMs = () =>
  Math.round(
    visibleDurationMs +
    (visibleStartedAt === null ? 0 : performance.now() - visibleStartedAt),
  );

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    pauseVisibleTimer();
    track("page_hidden", {
      visible_duration_ms: getVisibleDurationMs(),
      active_section: activeSectionId,
    });
    return;
  }

  visibleStartedAt = performance.now();
  activeSectionStartedAt = performance.now();
  track("page_visible", {
    visible_duration_ms: getVisibleDurationMs(),
    active_section: activeSectionId,
  });
});

window.setInterval(() => {
  if (document.visibilityState !== "visible") return;
  track("engagement_heartbeat", {
    visible_duration_ms: getVisibleDurationMs(),
    active_section: activeSectionId,
    scroll_depth: maxScrollDepth,
  });
}, 30_000);

window.addEventListener("pagehide", () => {
  pauseVisibleTimer();
  flushSectionDwell("session_end");
  track("session_ended", {
    duration_ms: Math.round(performance.now() - sessionStartedAt),
    visible_duration_ms: getVisibleDurationMs(),
    final_section: activeSectionId,
  });
});

if (!reducedMotionQuery.matches && !computeLowPowerMode()) {
  window.setTimeout(() => {
    track("hero_signal_settled", { duration_ms: 1800 });
  }, 1900);
}

track("site_loaded", {
  pointer: window.matchMedia("(pointer: coarse)").matches ? "coarse" : "fine",
  reduced_motion: reducedMotionQuery.matches,
  analytics_provider: getAnalyticsProviderName(),
});
initSectionTracking();

window.addEventListener("load", () => {
  scheduleIdle(initAnalyticsProvider, 900);
  scheduleIdle(trackLoadPerformance, 1200);
  scheduleIdle(() => {
    track("performance_context", {
      hardware_concurrency: navigator.hardwareConcurrency || null,
      device_memory: "deviceMemory" in navigator
        ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0)
        : null,
      low_power_mode: computeLowPowerMode(),
    });
  }, 1400);
});
