const CONTACT_FORM_ENDPOINT = import.meta.env.VITE_CONTACT_FORM_ENDPOINT ?? "/api/contact";
const ANALYTICS_ENDPOINT = import.meta.env.VITE_ANALYTICS_ENDPOINT ?? "";
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY ?? "";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";
const POSTHOG_SESSION_REPLAY = import.meta.env.VITE_POSTHOG_SESSION_REPLAY === "true";
const DEBUG_MODE = new URLSearchParams(window.location.search).get("debug") === "true";
const sessionStartedAt = performance.now();
const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: light)");
const sessionId = (() => {
  const storageKey = "ben_xu_portfolio_session_id";
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const nextId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem(storageKey, nextId);
  return nextId;
})();

type TrackPayload = Record<string, string | number | boolean | null>;
type HeroSceneHandle = {
  destroy: () => void;
};

type CubeEventDetail = {
  eventName?: string;
  face?: string | null;
  label?: string | null;
};

type DebugValue = string | number | boolean | null;

declare global {
  interface Window {
    posthog?: {
      capture: (eventName: string, payload?: TrackPayload) => void;
    };
  }
}

const computeLowPowerMode = () => {
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hardwareConcurrency = navigator.hardwareConcurrency || 8;
  const deviceMemory = "deviceMemory" in navigator
    ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0)
    : 0;
  return isMobile || coarsePointer || reducedMotion || hardwareConcurrency <= 8 || (deviceMemory > 0 && deviceMemory <= 8);
};

const shouldDeferHeroScene = () => {
  const handheld = window.matchMedia("(max-width: 900px), (pointer: coarse)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return handheld || reducedMotion;
};

const debugMetrics: Record<string, DebugValue> = {
  low_power_mode: computeLowPowerMode(),
  webgl: "waiting",
  hero_load_ms: null,
  about_story: "waiting",
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
  debugPanel.innerHTML = `<strong>Perf HUD</strong>${rows}`;
};

const updateDebugMetric = (key: string, value: DebugValue) => {
  debugMetrics[key] = value;
  renderDebugPanel();
};

renderDebugPanel();

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
    if (DEBUG_MODE) {
      console.warn("[portfolio:analytics]", error);
    }
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
    if (DEBUG_MODE) {
      console.warn("[portfolio:analytics-endpoint]", error);
    }
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
      autocapture: true,
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

colorSchemeQuery.addEventListener("change", (event) => {
  track("color_scheme_changed", {
    color_scheme: event.matches ? "light" : "dark",
  });
});

const scheduleIdle = (callback: () => void, timeout = 500) => {
  if ("requestIdleCallback" in window) {
    (window.requestIdleCallback as (idleCallback: () => void, options?: { timeout: number }) => number)(
      callback,
      { timeout },
    );
    return;
  }

  globalThis.setTimeout(callback, timeout);
};

const alignHashTarget = (force = false) => {
  const hash = window.location.hash;
  if (!hash || hash === "#home") return;

  const target = document.querySelector<HTMLElement>(hash);
  if (!target) return;

  const rect = target.getBoundingClientRect();
  const hasDrifted = rect.top > window.innerHeight * 0.35 || rect.bottom < 120;
  if (!force && !hasDrifted) return;

  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  target.scrollIntoView({
    behavior: "auto",
    block: "start",
  });
  window.requestAnimationFrame(() => {
    root.style.scrollBehavior = previousScrollBehavior;
  });
};

const scheduleHashAlignment = (force = false) => {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => alignHashTarget(force));
  });
};

let resizeAlignmentTimer = 0;

window.addEventListener("hashchange", () => scheduleHashAlignment(true));
window.addEventListener(
  "resize",
  () => {
    window.clearTimeout(resizeAlignmentTimer);
    resizeAlignmentTimer = window.setTimeout(() => scheduleHashAlignment(false), 160);
  },
  { passive: true },
);
window.visualViewport?.addEventListener(
  "resize",
  () => {
    window.clearTimeout(resizeAlignmentTimer);
    resizeAlignmentTimer = window.setTimeout(() => scheduleHashAlignment(false), 160);
  },
  { passive: true },
);

let heroScene: HeroSceneHandle | null = null;
let heroSceneLoading = false;

const getLowPowerMode = () => {
  const lowPowerMode = computeLowPowerMode();
  updateDebugMetric("low_power_mode", lowPowerMode);
  return lowPowerMode;
};

const initHeroScene = async () => {
  if (heroScene || heroSceneLoading) return;
  const canvas = document.querySelector<HTMLCanvasElement>("#hero-canvas");
  const heroRight = document.querySelector<HTMLElement>(".hero-right");
  if (!canvas || !heroRight) return;

  heroSceneLoading = true;
  const lowPowerMode = getLowPowerMode();
  const loadStartedAt = performance.now();
  updateDebugMetric("webgl", "loading");
  track("cube_load_requested", {
    low_power_mode: lowPowerMode,
  });

  try {
    const { createHeroScene } = await import("./heroScene");
    heroScene = createHeroScene(canvas, {
      lowPowerMode,
      onReady: () => {
        heroRight.classList.add("is-webgl-ready");
        const loadMs = Math.round(performance.now() - loadStartedAt);
        updateDebugMetric("webgl", "ready");
        updateDebugMetric("hero_load_ms", loadMs);
        track("cube_loaded", {
          load_ms: loadMs,
          low_power_mode: lowPowerMode,
        });
      },
    });
  } catch (error) {
    updateDebugMetric("webgl", "failed");
    track("cube_load_failed", {
      low_power_mode: lowPowerMode,
    });
    console.error("[portfolio:webgl]", error);
  } finally {
    heroSceneLoading = false;
  }
};

const scheduleHeroScene = () => {
  const heroRight = document.querySelector<HTMLElement>(".hero-right");
  const loadButton = heroRight?.querySelector<HTMLButtonElement>("[data-load-cube]");
  if (!heroRight) return;

  if (shouldDeferHeroScene()) {
    heroRight.classList.add("is-webgl-deferred");
    updateDebugMetric("webgl", "deferred");
    track("cube_deferred", {
      reason: "handheld_or_reduced_motion",
    });

    const loadFromIntent = () => {
      heroRight.classList.remove("is-webgl-deferred");
      loadButton?.removeEventListener("click", loadFromIntent);
      void initHeroScene();
      track("cube_load_requested_by_user");
    };

    loadButton?.addEventListener("click", loadFromIntent, { once: true });
    return;
  }

  if ("IntersectionObserver" in window) {
    const sceneObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        sceneObserver.disconnect();
        scheduleIdle(() => {
          void initHeroScene();
        }, 1000);
      },
      { rootMargin: "0px 0px 160px 0px", threshold: 0.1 },
    );
    sceneObserver.observe(heroRight);
    return;
  }

  scheduleIdle(() => {
    void initHeroScene();
  }, 1400);
};

window.addEventListener("pagehide", () => {
  heroScene?.destroy();
});

window.addEventListener("error", () => {
  const nextErrorCount = Number(debugMetrics.errors || 0) + 1;
  updateDebugMetric("errors", nextErrorCount);
  track("client_error", {
    type: "error",
  });
});

window.addEventListener("unhandledrejection", () => {
  const nextErrorCount = Number(debugMetrics.errors || 0) + 1;
  updateDebugMetric("errors", nextErrorCount);
  track("client_error", {
    type: "unhandledrejection",
  });
});

window.addEventListener("portfolio:cube_event", (event) => {
  const detail = (event as CustomEvent<CubeEventDetail>).detail;
  if (!detail?.eventName) return;

  track(detail.eventName, {
    face: detail.face ?? null,
    label: detail.label ?? null,
  });
});

const ABOUT_SUBTITLES = [
  "Find the messy workflow.",
  "Build the operating system.",
  "Automate the repetitive parts.",
  "Make the work visible.",
  "Move faster with less chaos.",
] as const;

const ABOUT_FALLBACK_DURATION = 12;

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};

const initAboutStory = () => {
  const card = document.querySelector<HTMLElement>("[data-brainrot]");
  if (!card) return;

  const playbackButton = card.querySelector<HTMLButtonElement>("[data-playback-button]");
  const fullscreenButton = card.querySelector<HTMLButtonElement>("[data-fullscreen-button]");
  const subtitle = card.querySelector<HTMLElement>("[data-subtitle]");
  const currentTimeLabel = card.querySelector<HTMLElement>("[data-current-time]");
  const durationLabel = card.querySelector<HTMLElement>("[data-duration]");
  const progress = card.querySelector<HTMLElement>("[data-progress]");
  const dots = Array.from(card.querySelectorAll<HTMLElement>("[data-subtitle-dots] span"));
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let subtitleIndex = 0;
  let isPlaying = !prefersReducedMotion;
  let syntheticStartedAt = performance.now();
  let syntheticElapsed = 0;
  let isStoryVisible = false;

  const setSubtitle = (index: number) => {
    subtitleIndex = index % ABOUT_SUBTITLES.length;
    if (subtitle) subtitle.textContent = ABOUT_SUBTITLES[subtitleIndex];
    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === subtitleIndex);
    });
  };

  const setPlaying = (nextPlaying: boolean) => {
    isPlaying = nextPlaying;
    card.classList.toggle("is-paused", !isPlaying);
    playbackButton?.setAttribute("aria-label", isPlaying ? "Pause animation" : "Play animation");
  };

  const getCurrentTime = () => {
    if (isPlaying && !prefersReducedMotion) {
      return ((performance.now() - syntheticStartedAt) / 1000) % ABOUT_FALLBACK_DURATION;
    }

    return syntheticElapsed;
  };

  const syncProgress = () => {
    const duration = ABOUT_FALLBACK_DURATION;
    const current = getCurrentTime();
    const amount = Math.min(1, Math.max(0, current / duration));

    if (currentTimeLabel) currentTimeLabel.textContent = formatTime(current);
    if (durationLabel) durationLabel.textContent = formatTime(duration);
    progress?.style.setProperty("--progress", String(amount));
  };

  const pauseSyntheticClock = () => {
    syntheticElapsed = getCurrentTime();
  };

  const resumeSyntheticClock = () => {
    syntheticStartedAt = performance.now() - syntheticElapsed * 1000;
  };

  updateDebugMetric("about_story", "css animation");

  if ("IntersectionObserver" in window) {
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isStoryVisible = Boolean(entry?.isIntersecting);
        card.classList.toggle("is-story-visible", isStoryVisible);
        if (isStoryVisible) syncProgress();
      },
      { threshold: 0.08 },
    );
    visibilityObserver.observe(card);
  } else {
    isStoryVisible = true;
    card.classList.add("is-story-visible");
  }

  playbackButton?.addEventListener("click", () => {
    if (isPlaying) {
      pauseSyntheticClock();
      setPlaying(false);
    } else {
      resumeSyntheticClock();
      setPlaying(true);
    }

    track("about_playback_toggled", {
      playing: isPlaying,
    });
    syncProgress();
  });

  fullscreenButton?.addEventListener("click", () => {
    const frame = card.querySelector<HTMLElement>(".brainrot-frame");
    frame?.requestFullscreen?.();
    track("about_fullscreen_clicked");
  });

  if (!prefersReducedMotion) {
    window.setInterval(() => {
      if (!isPlaying || !isStoryVisible || document.visibilityState !== "visible") return;
      setSubtitle(subtitleIndex + 1);
    }, 3200);
  }

  window.setInterval(() => {
    if (!isStoryVisible || document.visibilityState !== "visible") return;
    syncProgress();
  }, 800);
  setSubtitle(0);
  setPlaying(isPlaying);
  syncProgress();
};

initAboutStory();

const initExperienceToggles = () => {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".experience-card"));
  if (!cards.length) return;

  const setExpanded = (card: HTMLElement, expanded: boolean) => {
    card.classList.toggle("is-expanded", expanded);
    const toggle = card.querySelector<HTMLButtonElement>(".experience-toggle");
    toggle?.setAttribute("aria-expanded", String(expanded));
    const label = Array.from(toggle?.childNodes ?? []).find((node) => node.nodeType === Node.TEXT_NODE);
    if (label) label.textContent = expanded ? "Show less " : "Read more ";
  };

  cards.forEach((card) => {
    setExpanded(card, false);

    const toggle = card.querySelector<HTMLButtonElement>(".experience-toggle");
    toggle?.addEventListener("click", () => {
      const nextExpanded = !card.classList.contains("is-expanded");
      setExpanded(card, nextExpanded);

      track("experience_card_toggled", {
        card: card.id || "unknown",
        expanded: nextExpanded,
      });
    });
  });
};

initExperienceToggles();

const initExperienceCardTracking = () => {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".experience-card"));
  if (!cards.length || !("IntersectionObserver" in window)) return;

  const seenCards = new Set<string>();
  const cardObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const card = entry.target as HTMLElement;
        const cardId = card.id || "unknown";
        if (seenCards.has(cardId)) return;
        seenCards.add(cardId);
        track("experience_card_viewed", {
          card: cardId,
        });
        cardObserver.unobserve(card);
      });
    },
    {
      threshold: 0.45,
    },
  );

  cards.forEach((card) => cardObserver.observe(card));
};

initExperienceCardTracking();

const initPremiumExperience = () => {
  const root = document.documentElement;
  const ambientPointer = document.querySelector<HTMLElement>(".ambient-pointer");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const lowPowerMode = computeLowPowerMode();
  const enhancedMotion = finePointer && !reducedMotion && !lowPowerMode;

  root.classList.add("is-enhanced");
  root.classList.toggle("is-low-power", lowPowerMode);

  const revealTargets = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        ".hero-name",
        ".role-kicker",
        ".hero-title",
        ".hero-proof",
        ".hero-actions",
        ".experience-header",
        ".experience-card",
        ".experience-nudge",
        ".about-copy > *",
        ".brainrot-card",
        ".contact-copy > *",
        ".contact-inbox",
      ].join(","),
    ),
  );

  revealTargets.forEach((element, index) => {
    element.classList.add("reveal-item");
    element.style.setProperty("--reveal-order", String(index % 6));
  });

  const heroRevealTargets = revealTargets.filter((element) => Boolean(element.closest(".hero")));
  window.requestAnimationFrame(() => {
    heroRevealTargets.forEach((element) => element.classList.add("is-visible"));
  });

  if ("IntersectionObserver" in window && !reducedMotion) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.12,
      },
    );

    revealTargets
      .filter((element) => !element.closest(".hero"))
      .forEach((element) => revealObserver.observe(element));
  } else {
    revealTargets.forEach((element) => element.classList.add("is-visible"));
  }

  if (enhancedMotion && ambientPointer) {
    let pointerFrame = 0;
    let pointerX = window.innerWidth * 0.68;
    let pointerY = window.innerHeight * 0.34;
    let hasTrackedPointer = false;

    const renderPointer = () => {
      pointerFrame = 0;
      ambientPointer.style.setProperty("--pointer-x", `${pointerX}px`);
      ambientPointer.style.setProperty("--pointer-y", `${pointerY}px`);
      root.style.setProperty("--pointer-x-ratio", String(pointerX / Math.max(window.innerWidth, 1)));
      root.style.setProperty("--pointer-y-ratio", String(pointerY / Math.max(window.innerHeight, 1)));
    };

    window.addEventListener(
      "pointermove",
      (event) => {
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (!pointerFrame) pointerFrame = window.requestAnimationFrame(renderPointer);
        if (!hasTrackedPointer) {
          hasTrackedPointer = true;
          track("ambient_pointer_engaged");
        }
      },
      { passive: true },
    );
    renderPointer();

  }

};

initPremiumExperience();

const initPerformanceAnalytics = () => {
  if (!("PerformanceObserver" in window)) return;

  let largestContentfulPaint = 0;
  let cumulativeLayoutShift = 0;
  let interactionLatency = 0;
  let longTaskCount = 0;
  let longTaskDuration = 0;

  const supported = PerformanceObserver.supportedEntryTypes ?? [];

  if (supported.includes("largest-contentful-paint")) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        largestContentfulPaint = Math.max(largestContentfulPaint, entry.startTime);
      });
    });
    observer.observe({ type: "largest-contentful-paint", buffered: true });
  }

  if (supported.includes("layout-shift")) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!shift.hadRecentInput) cumulativeLayoutShift += shift.value ?? 0;
      });
    });
    observer.observe({ type: "layout-shift", buffered: true });
  }

  if (supported.includes("event")) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        interactionLatency = Math.max(interactionLatency, entry.duration);
      });
    });
    observer.observe({ type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
  }

  if (supported.includes("longtask")) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        longTaskCount += 1;
        longTaskDuration += entry.duration;
      });
    });
    observer.observe({ type: "longtask", buffered: true });
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

let maxScrollDepth = 0;
let scrollDepthQueued = false;
let hasScrolled = false;
const scrollDepthMilestones = [25, 50, 75, 100];
const trackedScrollDepths = new Set<number>();

const updateScrollDepth = () => {
  scrollDepthQueued = false;
  const totalHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const depth = totalHeight <= window.innerHeight
    ? 100
    : Math.min(100, Math.round(((window.scrollY + window.innerHeight) / totalHeight) * 100));

  if (depth <= maxScrollDepth) return;

  maxScrollDepth = depth;
  updateDebugMetric("max_scroll_depth", `${maxScrollDepth}%`);

  scrollDepthMilestones.forEach((milestone) => {
    if (maxScrollDepth < milestone || trackedScrollDepths.has(milestone)) return;
    trackedScrollDepths.add(milestone);
    track("scroll_depth", {
      depth_percent: milestone,
    });
  });
};

window.addEventListener(
  "scroll",
  () => {
    if (!hasScrolled && window.scrollY > 4) {
      hasScrolled = true;
      track("scroll_started");
    }
    if (scrollDepthQueued) return;
    scrollDepthQueued = true;
    window.requestAnimationFrame(updateScrollDepth);
  },
  { passive: true },
);

const scrollToContactForm = (location: string) => {
  track("contact_clicked", { location });

  const contactSection = document.querySelector<HTMLElement>("#contact");
  const messageField = document.querySelector<HTMLTextAreaElement>("#contact-message");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  contactSection?.scrollIntoView({
    behavior: reducedMotion ? "auto" : "smooth",
    block: "start",
  });

  globalThis.setTimeout(() => {
    messageField?.focus({ preventScroll: true });
  }, reducedMotion ? 0 : 420);
};

const contactButtons = document.querySelectorAll<HTMLElement>("[data-contact]");

contactButtons.forEach((button) => {
  button.addEventListener("click", () => {
    scrollToContactForm(button.className || "unknown");
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

  resetStartedAt();

  const setStatus = (message: string, type: "idle" | "success" | "error" = "idle") => {
    status.textContent = message;
    status.classList.remove("is-success", "is-error");
    if (type === "success") status.classList.add("is-success");
    if (type === "error") status.classList.add("is-error");
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      setStatus("Please complete the required fields.", "error");
      return;
    }

    const formData = new FormData(form);
    if (String(formData.get("website") ?? "").trim()) {
      form.reset();
      resetStartedAt();
      setStatus("Message sent — I'll get back to you soon.", "success");
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
    setStatus("Sending…");
    track("contact_form_submitted", { status: "started" });

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
      if (!response.ok || responseBody?.success === false) {
        throw new Error(responseBody?.message || "Form submission failed");
      }

      form.reset();
      resetStartedAt();
      setStatus("Message sent — I'll get back to you soon.", "success");
      track("contact_form_submitted", { status: "success" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "unknown";
      setStatus(
        /confirm|activate|verify/i.test(errorMessage)
          ? "Check the receiving inbox once to activate form delivery."
          : "Something went wrong. Please try again or use LinkedIn.",
        "error",
      );
      track("contact_form_submitted", {
        status: "error",
        error: errorMessage,
      });
    } finally {
      submitButton.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });
};

initContactForm();

const navLinks = document.querySelectorAll<HTMLAnchorElement>("[data-nav-link]");

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    track("nav_clicked", {
      target: link.getAttribute("href"),
      label: link.textContent?.trim() || null,
    });
  });
});

const observedSections = document.querySelectorAll<HTMLElement>(".section-observed");
const viewedSections = new Set<string>();
const sectionDwell = new Map<string, { startedAt: number | null; totalMs: number; maxRatio: number }>();
const sectionVisibility = new Map<string, number>();

observedSections.forEach((section) => {
  sectionDwell.set(section.id || "unknown", {
    startedAt: null,
    totalMs: 0,
    maxRatio: 0,
  });
  sectionVisibility.set(section.id || "unknown", 0);
});

const getSectionIdForElement = (element: Element | null) =>
  element?.closest<HTMLElement>("section")?.id || "global";

const flushSectionDwell = (reason: string, keepActive = true) => {
  const now = performance.now();

  sectionDwell.forEach((state, section) => {
    if (state.startedAt !== null) {
      state.totalMs += now - state.startedAt;
      state.startedAt = keepActive ? now : null;
    }

    if (state.totalMs < 400) return;

    track("section_dwell", {
      section,
      duration_ms: Math.round(state.totalMs),
      max_ratio: Number(state.maxRatio.toFixed(2)),
      reason,
    });

    state.totalMs = 0;
    state.maxRatio = 0;
  });
};

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const section = entry.target as HTMLElement;
      const sectionId = section.id;
      const dwellState = sectionDwell.get(sectionId);
      sectionVisibility.set(sectionId, entry.isIntersecting ? entry.intersectionRatio : 0);

      if (dwellState) {
        dwellState.maxRatio = Math.max(dwellState.maxRatio, entry.intersectionRatio);

        if (entry.isIntersecting && entry.intersectionRatio >= 0.28 && dwellState.startedAt === null) {
          dwellState.startedAt = performance.now();
        } else if ((!entry.isIntersecting || entry.intersectionRatio < 0.12) && dwellState.startedAt !== null) {
          dwellState.totalMs += performance.now() - dwellState.startedAt;
          dwellState.startedAt = null;

          if (dwellState.totalMs >= 400) {
            track("section_dwell", {
              section: sectionId,
              duration_ms: Math.round(dwellState.totalMs),
              max_ratio: Number(dwellState.maxRatio.toFixed(2)),
              reason: "section_exit",
            });
            dwellState.totalMs = 0;
            dwellState.maxRatio = 0;
          }
        }
      }

      if (entry.isIntersecting) {
        if (!viewedSections.has(sectionId)) {
          viewedSections.add(sectionId);
          track("section_viewed", {
            section: sectionId,
          });

          if (sectionId === "home") {
            track("hero_viewed");
          }
        }
      }
    });

    const activeSection = [...sectionVisibility.entries()].reduce(
      (best, current) => (current[1] > best[1] ? current : best),
      ["", 0] as [string, number],
    )[0];

    navLinks.forEach((link) => {
      const target = link.getAttribute("href")?.replace("#", "");
      link.classList.toggle("active", target === activeSection);
    });

  },
  {
    threshold: [0, 0.12, 0.28, 0.42, 0.65, 0.9],
  },
);

observedSections.forEach((section) => {
  sectionObserver.observe(section);
});

document.addEventListener(
  "click",
  (event) => {
    const target = event.target as Element | null;
    const action = target?.closest<HTMLElement>("a, button, [role='button']");
    if (!action) return;

    const label = action.getAttribute("aria-label") || action.textContent?.replace(/\s+/g, " ").trim() || action.id || "unlabeled";
    track("ui_clicked", {
      section: getSectionIdForElement(action),
      tag: action.tagName.toLowerCase(),
      label: label.slice(0, 96),
      href: action instanceof HTMLAnchorElement ? action.href : null,
      id: action.id || null,
    });
  },
  { capture: true },
);

const focusedContactFields = new Set<string>();

document.addEventListener("focusin", (event) => {
  const field = (event.target as Element | null)?.closest<HTMLInputElement | HTMLTextAreaElement>(
    ".contact-inbox input, .contact-inbox textarea",
  );
  if (!field || field.name === "website" || field.type === "hidden" || focusedContactFields.has(field.name)) return;

  focusedContactFields.add(field.name);
  track("contact_field_focused", {
    field: field.name,
  });
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

document.addEventListener("click", (event) => {
  const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[target='_blank']");
  if (!link) return;
  track("outbound_link_clicked", {
    destination: link.hostname,
    label: link.getAttribute("aria-label") || link.textContent?.trim() || null,
  });
});

let visibleStartedAt: number | null = document.visibilityState === "visible" ? performance.now() : null;
let visibleDurationMs = 0;

const getVisibleDurationMs = () =>
  Math.round(visibleDurationMs + (visibleStartedAt === null ? 0 : performance.now() - visibleStartedAt));

const getActiveSection = () => {
  for (const [section, state] of sectionDwell.entries()) {
    if (state.startedAt !== null) return section;
  }
  return null;
};

const pauseVisibleTimer = () => {
  if (visibleStartedAt === null) return;
  visibleDurationMs += performance.now() - visibleStartedAt;
  visibleStartedAt = null;
};

const resumeCurrentSectionDwell = () => {
  const section = document
    .elementFromPoint(window.innerWidth / 2, Math.min(window.innerHeight / 2, window.innerHeight - 1))
    ?.closest<HTMLElement>("section");
  const sectionId = section?.id;
  const state = sectionId ? sectionDwell.get(sectionId) : undefined;
  if (!state || state.startedAt !== null) return;
  state.startedAt = performance.now();
};

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    pauseVisibleTimer();
    flushSectionDwell("page_hidden", false);
    track("page_hidden", {
      visible_duration_ms: getVisibleDurationMs(),
      active_section: getActiveSection(),
    });
    return;
  }

  visibleStartedAt = performance.now();
  resumeCurrentSectionDwell();
  track("page_visible", {
    visible_duration_ms: getVisibleDurationMs(),
    max_scroll_depth: maxScrollDepth,
  });
});

window.setInterval(() => {
  if (document.visibilityState !== "visible") return;
  track("engagement_heartbeat", {
    visible_duration_ms: getVisibleDurationMs(),
    max_scroll_depth: maxScrollDepth,
    active_section: getActiveSection(),
    scrolled: hasScrolled,
  });
}, 30000);

window.addEventListener("pagehide", () => {
  pauseVisibleTimer();
  flushSectionDwell("session_end", false);
  track("session_ended", {
    duration_ms: Math.round(performance.now() - sessionStartedAt),
    visible_duration_ms: getVisibleDurationMs(),
    max_scroll_depth: maxScrollDepth,
    scrolled: hasScrolled,
    sections_viewed: viewedSections.size,
  });
});

window.addEventListener("load", () => {
  scheduleHeroScene();
  scheduleHashAlignment(true);
  globalThis.setTimeout(() => scheduleHashAlignment(false), 500);
  track("site_loaded", {
    path: window.location.pathname,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    pointer: window.matchMedia("(pointer: coarse)").matches ? "coarse" : "fine",
    reduced_motion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    analytics_provider: POSTHOG_KEY ? "posthog" : ANALYTICS_ENDPOINT ? "custom" : "unconfigured",
  });

  scheduleIdle(() => {
    void initAnalyticsProvider();
  }, 2200);

  scheduleIdle(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (!navigation) return;

    track("performance_timing", {
      dom_content_loaded_ms: Math.round(navigation.domContentLoadedEventEnd),
      load_event_ms: Math.round(navigation.loadEventEnd),
      response_ms: Math.round(navigation.responseEnd),
      transfer_size: navigation.transferSize || null,
    });

    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const transferredBytes = resources.reduce((total, resource) => total + (resource.transferSize || 0), 0);
    track("resource_summary", {
      resource_count: resources.length,
      transfer_size: transferredBytes,
      script_count: resources.filter((resource) => resource.initiatorType === "script").length,
      image_count: resources.filter((resource) => resource.initiatorType === "img").length,
    });
  }, 1800);
});
