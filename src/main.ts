const CONTACT_FORM_ENDPOINT = "https://formspree.io/f/mbdvorzn";
const ANALYTICS_ENDPOINT = import.meta.env.VITE_ANALYTICS_ENDPOINT ?? "";
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY ?? "";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";
const POSTHOG_SESSION_REPLAY = import.meta.env.VITE_POSTHOG_SESSION_REPLAY === "true";
const DEBUG_MODE = new URLSearchParams(window.location.search).get("debug") === "true";
const sessionStartedAt = performance.now();
const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: light)");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
const smallViewportQuery = window.matchMedia("(max-width: 680px)");

type TrackPayload = Record<string, string | number | boolean | null>;
type DebugValue = string | number | boolean | null;
type ContactSubmitResponse = {
  ok?: boolean;
  errors?: Array<{
    field?: string;
    message?: string;
  }>;
};
type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
};

declare global {
  interface Window {
    posthog?: {
      capture: (eventName: string, payload?: TrackPayload) => void;
    };
  }
}

const sections = [
  { id: "home", name: "Landing Page" },
  { id: "about", name: "About" },
  { id: "experience", name: "Experience" },
  { id: "contact", name: "Contact" },
] as const;

const getNetworkInformation = () =>
  "connection" in navigator
    ? (navigator as Navigator & { connection?: NetworkInformationLike }).connection
    : undefined;

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
  const reducedMotion = reducedMotionQuery.matches;
  const hardwareConcurrency = navigator.hardwareConcurrency || 8;
  const deviceMemory = "deviceMemory" in navigator
    ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0)
    : 0;
  const connection = getNetworkInformation();
  const constrainedNetwork =
    Boolean(connection?.saveData) ||
    ["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "") ||
    (typeof connection?.downlink === "number" && connection.downlink > 0 && connection.downlink <= 0.7);

  return (
    isMobile ||
    reducedMotion ||
    constrainedNetwork ||
    hardwareConcurrency <= 4 ||
    (deviceMemory > 0 && deviceMemory <= 4)
  );
};

const debugMetrics: Record<string, DebugValue> = {
  active_section: "Landing Page",
  analytics: "initializing",
  errors: 0,
  low_power_mode: computeLowPowerMode(),
  scroll_depth: "0%",
};
let debugPanel: HTMLElement | null = null;

const applyMotionTokens = () => {
  const motionProperties = [
    ["ox", "--ox"],
    ["oy", "--oy"],
    ["or", "--or"],
    ["os", "--os"],
    ["delay", "--delay"],
    ["floatDelay", "--float-delay"],
  ] as const;
  const lineProperties = [
    ["lx", "--lx"],
    ["ly", "--ly"],
    ["lr", "--lr"],
  ] as const;

  document.querySelectorAll<HTMLElement | SVGElement>("[data-ox]").forEach((element) => {
    motionProperties.forEach(([dataKey, cssVariable]) => {
      const value = element.dataset[dataKey];
      if (value) element.style.setProperty(cssVariable, value);
    });
  });

  document.querySelectorAll<SVGElement>("[data-lx]").forEach((element) => {
    lineProperties.forEach(([dataKey, cssVariable]) => {
      const value = element.dataset[dataKey];
      if (value) element.style.setProperty(cssVariable, value);
    });
  });
};

const renderDebugPanel = () => {
  if (!DEBUG_MODE) return;
  if (!debugPanel) {
    debugPanel = document.createElement("aside");
    debugPanel.className = "debug-panel";
    debugPanel.setAttribute("aria-label", "Portfolio debug panel");
    document.body.append(debugPanel);
  }

  const title = document.createElement("strong");
  title.textContent = "Portfolio HUD";

  const rows = Object.entries(debugMetrics).map(([key, value]) => {
    const label = document.createElement("span");
    label.textContent = key;

    const metric = document.createElement("b");
    metric.textContent = String(value ?? "-");

    return [label, metric] as const;
  });

  debugPanel.replaceChildren(title, ...rows.flat());
};

const updateDebugMetric = (key: string, value: DebugValue) => {
  debugMetrics[key] = value;
  renderDebugPanel();
};

renderDebugPanel();
applyMotionTokens();

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

const getAnalyticsProviderName = () => {
  if (POSTHOG_KEY) return "posthog";
  if (ANALYTICS_ENDPOINT) return "custom_endpoint";
  return "none";
};

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

const scheduleIdle = (callback: () => void, timeout = 500) => {
  if ("requestIdleCallback" in window) {
    (
      window.requestIdleCallback as (
        idleCallback: () => void,
        options?: { timeout: number },
      ) => number
    )(callback, { timeout });
    return;
  }

  globalThis.setTimeout(callback, timeout);
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

const initHeroMotion = () => {
  const hero = document.querySelector<HTMLElement>("[data-bridge-hero]");
  if (!hero) return;

  if (reducedMotionQuery.matches) {
    hero.classList.add("is-ready", "is-settled");
    track("hero_assembly_completed", { duration_ms: 0 });
    return;
  }

  const orbitObjects = Array.from(hero.querySelectorAll<HTMLElement>(".orbit-object"));
  const canSwarm = !coarsePointerQuery.matches && !smallViewportQuery.matches && !computeLowPowerMode();
  const introDuration = canSwarm ? 3400 : 1200;
  const orbitStart = performance.now();
  let orbitFrame = 0;

  const setOrbitState = (
    element: HTMLElement,
    x = 0,
    y = 0,
    depth = 0,
    scale = 1,
    blur = 0,
  ) => {
    element.style.setProperty("--orbit-float-x", `${x.toFixed(2)}px`);
    element.style.setProperty("--orbit-float-y", `${y.toFixed(2)}px`);
    element.style.setProperty("--orbit-depth", `${depth.toFixed(2)}px`);
    element.style.setProperty("--orbit-scale", scale.toFixed(3));
    element.style.setProperty("--orbit-blur", `${blur.toFixed(2)}px`);
  };

  const setSwarmState = (
    element: HTMLElement,
    x = 0,
    y = 0,
    rotation = 0,
    scale = 1,
  ) => {
    element.style.setProperty("--swarm-x", `${x.toFixed(2)}px`);
    element.style.setProperty("--swarm-y", `${y.toFixed(2)}px`);
    element.style.setProperty("--swarm-r", `${rotation.toFixed(2)}deg`);
    element.style.setProperty("--swarm-scale", scale.toFixed(3));
  };

  const runWordSphere = (now: number) => {
    if (hero.classList.contains("is-settled")) return;

    const bounds = hero.getBoundingClientRect();
    const t = (now - orbitStart) / 1000;
    const resolveProgress = Math.min(1, (now - orbitStart) / introDuration);
    const collapse = Math.max(0, (resolveProgress - 0.64) / 0.36);
    const roam = 1 - collapse * collapse * (3 - 2 * collapse);
    const fieldX = Math.min(520, bounds.width * 0.42);
    const fieldY = Math.min(300, bounds.height * 0.34);

    orbitObjects.forEach((element, index) => {
      const ring = index % 5;
      const groupWeight = element.closest(".headline")
        ? 1
        : element.closest(".label-group")
          ? 0.72
          : 0.94;
      const radius = 7 + ring * 3.8;
      const phase = index * 0.86;
      const speed = 0.82 + (index % 4) * 0.18;
      const pathX = fieldX * (0.42 + (index % 4) * 0.15) * groupWeight;
      const pathY = fieldY * (0.46 + ((index + 2) % 4) * 0.12) * groupWeight;
      const ellipse = t * speed + phase;
      const counter = t * (speed * 0.64 + 0.18) - phase * 0.72;
      const travelX = (Math.cos(ellipse) * pathX + Math.sin(counter) * pathX * 0.28) * roam;
      const travelY = (Math.sin(ellipse * 0.84) * pathY + Math.cos(counter) * pathY * 0.18) * roam;
      const travelRotation = Math.sin(ellipse + phase) * 9 * roam;
      const travelScale = 1 + Math.sin(counter + index) * 0.035 * roam;
      const x = Math.cos(t * (speed + 0.22) + phase) * radius * roam;
      const y = Math.sin(t * (speed + 0.36) + phase * 1.14) * radius * 0.58 * roam;
      const z = Math.sin(t * (speed * 0.82) + phase) * 26 * roam;
      const scale = 1 + z / 900;
      const blur = Math.max(0, z < -8 ? Math.abs(z) / 62 : 0);

      setSwarmState(element, travelX, travelY, travelRotation, travelScale);
      setOrbitState(element, x, y, z, scale, blur);
    });

    orbitFrame = window.requestAnimationFrame(runWordSphere);
  };

  window.requestAnimationFrame(() => hero.classList.add("is-ready"));
  if (canSwarm) {
    orbitFrame = window.requestAnimationFrame(runWordSphere);
  }

  globalThis.setTimeout(() => {
    if (orbitFrame) window.cancelAnimationFrame(orbitFrame);
    orbitObjects.forEach((element) => {
      setSwarmState(element);
      setOrbitState(element);
    });
    hero.classList.add("is-settled");
    track("hero_assembly_completed", { duration_ms: introDuration });
  }, introDuration);
};

const initHeroPointerLighting = () => {
  const hero = document.querySelector<HTMLElement>("[data-bridge-hero]");
  if (!hero || reducedMotionQuery.matches || coarsePointerQuery.matches || computeLowPowerMode()) return;

  let raf = 0;
  let targetX = 0.5;
  let targetY = 0.46;
  let currentX = 0.5;
  let currentY = 0.46;
  let paused = false;

  const render = () => {
    raf = 0;
    if (paused || !hero.classList.contains("is-settled")) return;

    currentX += (targetX - currentX) * 0.07;
    currentY += (targetY - currentY) * 0.07;

    hero.style.setProperty("--light-x", `${(currentX * 100).toFixed(2)}%`);
    hero.style.setProperty("--light-y", `${(currentY * 100).toFixed(2)}%`);
    hero.style.setProperty("--parallax-x", `${((currentX - 0.5) * 4).toFixed(2)}px`);
    hero.style.setProperty("--parallax-y", `${((currentY - 0.46) * 3).toFixed(2)}px`);

    if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
      raf = window.requestAnimationFrame(render);
    }
  };

  const schedule = () => {
    if (!raf) raf = window.requestAnimationFrame(render);
  };

  window.addEventListener(
    "pointermove",
    (event) => {
      const rect = hero.getBoundingClientRect();
      targetX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      targetY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
      schedule();
    },
    { passive: true },
  );

  document.addEventListener("visibilitychange", () => {
    paused = document.hidden;
    if (paused && raf) {
      window.cancelAnimationFrame(raf);
      raf = 0;
    }
    if (!paused) schedule();
  });
};

const initRevealMotion = () => {
  const revealItems = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
  if (!revealItems.length) return;

  if (reducedMotionQuery.matches || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
  );

  revealItems.forEach((item) => observer.observe(item));
};

const sectionElements = sections
  .map((section) => document.getElementById(section.id))
  .filter((section): section is HTMLElement => Boolean(section));

let activeSectionId = "home";
let activeSectionStartedAt = performance.now();
let maxScrollDepth = 0;
const scrollMilestones = new Set<number>();

const getSectionName = (sectionId: string) =>
  sections.find((section) => section.id === sectionId)?.name ?? sectionId;

const flushSectionDwell = (reason: string) => {
  const durationMs = Math.round(performance.now() - activeSectionStartedAt);
  track("section_dwell", {
    section_id: activeSectionId,
    section_name: getSectionName(activeSectionId),
    duration_ms: durationMs,
    reason,
  });
  activeSectionStartedAt = performance.now();
};

const setActiveSection = (sectionId: string, source = "observer") => {
  if (sectionId === activeSectionId) return;
  flushSectionDwell("section_exit");
  activeSectionId = sectionId;
  activeSectionStartedAt = performance.now();
  updateDebugMetric("active_section", getSectionName(sectionId));

  document.querySelectorAll<HTMLAnchorElement>(".nav a").forEach((link) => {
    const active = link.getAttribute("href") === `#${sectionId}`;
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  track("section_viewed", {
    section_id: sectionId,
    section_name: getSectionName(sectionId),
    source,
  });
};

const initSectionObserver = () => {
  if (!sectionElements.length || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const section = visible?.target as HTMLElement | undefined;
      if (section?.id) setActiveSection(section.id);
    },
    { threshold: [0.24, 0.36, 0.5, 0.68], rootMargin: "-16% 0px -38% 0px" },
  );

  sectionElements.forEach((section) => observer.observe(section));
};

const initNavigationTracking = () => {
  document.querySelectorAll<HTMLAnchorElement>("[data-section-link]").forEach((link) => {
    link.addEventListener("click", () => {
      const href = link.getAttribute("href") ?? "";
      const targetId = href.replace("#", "") || "home";
      track("section_link_clicked", {
        target_section: targetId,
        label: link.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) || targetId,
      });
    });
  });
};

const initScrollDepthTracking = () => {
  let scrollQueued = false;

  window.addEventListener(
    "scroll",
    () => {
      if (scrollQueued) return;
      scrollQueued = true;
      window.requestAnimationFrame(() => {
        scrollQueued = false;
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        if (scrollable <= 0) return;
        const depth = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
        if (depth > maxScrollDepth) {
          maxScrollDepth = depth;
          updateDebugMetric("scroll_depth", `${depth}%`);
          [25, 50, 75, 100].forEach((milestone) => {
            if (depth < milestone || scrollMilestones.has(milestone)) return;
            scrollMilestones.add(milestone);
            track("page_scroll_depth", {
              depth_percent: milestone,
              active_section: activeSectionId,
            });
          });
        }
      });
    },
    { passive: true },
  );
};

const initContactForm = () => {
  const form = document.querySelector<HTMLFormElement>("[data-contact-form]");
  const status = document.querySelector<HTMLElement>("[data-contact-status]");
  const submitButton = document.querySelector<HTMLButtonElement>("[data-contact-submit]");
  if (!form || !status || !submitButton) return;

  let formStartTracked = false;

  const markFormStarted = () => {
    if (formStartTracked) return;
    formStartTracked = true;
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
    const formData = new FormData(form);

    track("contact_form_submitted", {
      has_name: Boolean(String(formData.get("name") ?? "").trim()),
      has_email: Boolean(String(formData.get("email") ?? "").trim()),
      provider: "formspree",
    });

    if (!form.checkValidity()) {
      form.reportValidity();
      setStatus("Please complete the required fields.", "error");
      track("contact_form_error", { provider: "formspree", status: "validation" });
      return;
    }

    if (String(formData.get("_gotcha") ?? "").trim()) {
      form.reset();
      setStatus("Message sent - I will be in touch soon.", "success");
      return;
    }

    submitButton.disabled = true;
    form.setAttribute("aria-busy", "true");
    setStatus("Sending...");

    try {
      const controller = new AbortController();
      const timeoutId = globalThis.setTimeout(() => controller.abort(), 12_000);
      const response = await fetch(CONTACT_FORM_ENDPOINT, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      }).finally(() => globalThis.clearTimeout(timeoutId));

      const responseBody = await response.json().catch(() => null) as ContactSubmitResponse | null;
      if (!response.ok || responseBody?.ok === false) {
        const message = responseBody?.errors?.[0]?.message || "Form submission failed";
        const requestError = new Error(message) as Error & {
          status?: number;
        };
        requestError.status = response.status;
        throw requestError;
      }

      form.reset();
      setStatus("Message sent - thanks.", "success");
      track("contact_form_success", {
        provider: "formspree",
      });
    } catch (error) {
      const contactError = error as Error & { status?: number };
      const statusCode = typeof contactError.status === "number" ? contactError.status : "network";
      setStatus("Message could not send. Please try again in a moment.", "error");
      track("contact_form_error", {
        provider: "formspree",
        status: statusCode,
      });
    } finally {
      submitButton.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });
};

const initContactFieldTracking = () => {
  const focusedContactFields = new Set<string>();

  document.addEventListener("focusin", (event) => {
    const field = (event.target as Element | null)?.closest<HTMLInputElement | HTMLTextAreaElement>(
      ".contact-inbox input, .contact-inbox textarea",
    );
    if (!field || field.name === "_gotcha" || field.type === "hidden" || focusedContactFields.has(field.name)) return;
    focusedContactFields.add(field.name);
    track("contact_field_focused", { field: field.name });
  });

  document.addEventListener("change", (event) => {
    const field = (event.target as Element | null)?.closest<HTMLInputElement | HTMLTextAreaElement>(
      ".contact-inbox input, .contact-inbox textarea",
    );
    if (!field || field.name === "_gotcha" || field.type === "hidden") return;
    track("contact_field_completed", {
      field: field.name,
      has_value: Boolean(field.value.trim()),
    });
  });
};

const initClickTracking = () => {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element | null;
      const action = target?.closest<HTMLElement>("a, button, [role='button'], summary");
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
};

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
        cls: Number(cumulativeLayoutShift.toFixed(4)),
        inp_ms: Math.round(interactionLatency),
        lcp_ms: Math.round(largestContentfulPaint),
        long_task_count: longTaskCount,
        long_task_duration_ms: Math.round(longTaskDuration),
      });
    },
    { once: true },
  );
};

const trackLoadPerformance = () => {
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;

  if (navigation) {
    track("performance_timing", {
      dom_content_loaded_ms: Math.round(
        navigation.domContentLoadedEventEnd - navigation.startTime,
      ),
      encoded_body_size: navigation.encodedBodySize || 0,
      load_event_ms: Math.round(navigation.loadEventEnd - navigation.startTime),
      response_end_ms: Math.round(navigation.responseEnd - navigation.startTime),
      transfer_size: navigation.transferSize || 0,
    });
  }

  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const scripts = resources.filter((resource) => resource.initiatorType === "script");
  const styles = resources.filter((resource) => resource.initiatorType === "link" || resource.initiatorType === "css");
  const images = resources.filter((resource) => resource.initiatorType === "img");
  const totalTransfer = resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0);

  track("resource_summary", {
    image_count: images.length,
    resource_count: resources.length,
    script_count: scripts.length,
    stylesheet_count: styles.length,
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

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    pauseVisibleTimer();
    flushSectionDwell("page_hidden");
    track("page_hidden", {
      active_section: activeSectionId,
      max_scroll_depth: maxScrollDepth,
      visible_duration_ms: getVisibleDurationMs(),
    });
    return;
  }

  visibleStartedAt = performance.now();
  activeSectionStartedAt = performance.now();
  track("page_visible", {
    active_section: activeSectionId,
    visible_duration_ms: getVisibleDurationMs(),
  });
});

window.setInterval(() => {
  if (document.visibilityState !== "visible") return;
  track("engagement_heartbeat", {
    active_section: activeSectionId,
    max_scroll_depth: maxScrollDepth,
    section_duration_ms: Math.round(performance.now() - activeSectionStartedAt),
    visible_duration_ms: getVisibleDurationMs(),
  });
}, 30_000);

window.addEventListener("pagehide", () => {
  pauseVisibleTimer();
  flushSectionDwell("session_end");
  track("session_ended", {
    duration_ms: Math.round(performance.now() - sessionStartedAt),
    final_section: activeSectionId,
    max_scroll_depth: maxScrollDepth,
    visible_duration_ms: getVisibleDurationMs(),
  });
});

window.addEventListener("resize", () => {
  updateDebugMetric("low_power_mode", computeLowPowerMode());
}, { passive: true });

initHeroMotion();
initHeroPointerLighting();
initRevealMotion();
initSectionObserver();
initNavigationTracking();
initScrollDepthTracking();
initContactForm();
initContactFieldTracking();
initClickTracking();
initPerformanceAnalytics();

track("site_loaded", {
  analytics_provider: getAnalyticsProviderName(),
  pointer: coarsePointerQuery.matches ? "coarse" : "fine",
  reduced_motion: reducedMotionQuery.matches,
});

track("section_viewed", {
  section_id: activeSectionId,
  section_name: getSectionName(activeSectionId),
  source: window.location.hash ? "hash" : "load",
});

window.addEventListener("load", () => {
  scheduleIdle(initAnalyticsProvider, 900);
  scheduleIdle(trackLoadPerformance, 1200);
  scheduleIdle(() => {
    const connection = getNetworkInformation();
    track("performance_context", {
      device_memory: "deviceMemory" in navigator
        ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0)
        : null,
      effective_connection_type: connection?.effectiveType ?? null,
      hardware_concurrency: navigator.hardwareConcurrency || null,
      low_power_mode: computeLowPowerMode(),
      network_downlink: connection?.downlink ?? null,
      network_rtt: connection?.rtt ?? null,
      save_data: Boolean(connection?.saveData),
    });
  }, 1400);
});
