import { gsap } from "gsap";
import Lenis from "lenis";

const CONTACT_FORM_ENDPOINT = import.meta.env.VITE_CONTACT_FORM_ENDPOINT ?? "/api/contact";
const ANALYTICS_ENDPOINT = import.meta.env.VITE_ANALYTICS_ENDPOINT ?? "";
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY ?? "";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";
const POSTHOG_SESSION_REPLAY = import.meta.env.VITE_POSTHOG_SESSION_REPLAY === "true";
const DEBUG_MODE = new URLSearchParams(window.location.search).get("debug") === "true";
const sessionStartedAt = performance.now();
const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: light)");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

type TrackPayload = Record<string, string | number | boolean | null>;
type DebugValue = string | number | boolean | null;
type ChannelSource = "nav" | "hero_cta" | "wheel" | "touch" | "keyboard" | "hash";

type ChannelDefinition = {
  number: string;
  name: string;
  sectionId: string;
  hash: string;
};

declare global {
  interface Window {
    posthog?: {
      capture: (eventName: string, payload?: TrackPayload) => void;
    };
  }
}

const channels = [
  { number: "Home", name: "Landing Page", sectionId: "home", hash: "#home" },
  { number: "About", name: "About", sectionId: "about", hash: "#about" },
  { number: "Experience", name: "Experience", sectionId: "experience", hash: "#experience" },
  { number: "Contact", name: "Contact", sectionId: "contact", hash: "#contact" },
] as const satisfies readonly ChannelDefinition[];

const hashChannels: Record<string, number> = {
  "#": 0,
  "#home": 0,
  "#landing": 0,
  "#about": 1,
  "#experience": 2,
  "#systems-shipped": 2,
  "#work-record": 2,
  "#case-files": 2,
  "#cases": 2,
  "#contact": 3,
  "#open-line": 3,
};

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
  return isMobile || reducedMotion || hardwareConcurrency <= 4 || (deviceMemory > 0 && deviceMemory <= 4);
};

const debugMetrics: Record<string, DebugValue> = {
  low_power_mode: computeLowPowerMode(),
  channel: "Home Landing Page",
  max_channel_scroll: "0%",
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
  debugPanel.innerHTML = `<strong>Signal HUD</strong>${rows}`;
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

const screen = document.querySelector<HTMLElement>("#screen");
const fill = document.querySelector<HTMLElement>("#fill");
const chNum = document.querySelector<HTMLElement>("#chNum");
const chName = document.querySelector<HTMLElement>("#chName");
const clockElement = document.querySelector<HTMLElement>("#clock");
const transitionOverlay = document.querySelector<HTMLElement>("[data-signal-transition]");
const transitionLabel = document.querySelector<HTMLElement>("[data-signal-label]");
const channelElements = Array.from(document.querySelectorAll<HTMLElement>(".channel"));
const navButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".desktop-nav button[data-goto]"));
const gotoControls = Array.from(document.querySelectorAll<HTMLElement>("[data-goto]"));

if (!screen || !fill || !chNum || !chName || channelElements.length !== channels.length) {
  throw new Error("Required broadcast interface elements are missing.");
}

let currentChannel = hashChannels[window.location.hash] ?? 0;
let switching = false;
let channelLenis: Lenis | null = null;
let lenisRaf = 0;
let channelDwellStartedAt = performance.now();
let lastWheelAt = 0;
let touchStartX = 0;
let touchStartY = 0;
let activeChannelMaxScroll = 0;
let activeChannelHasScrolled = false;
let heroMotionStarted = false;
const trackedChannelScrollMilestones = new Set<number>();

const formatClockPart = (value: number) => String(value).padStart(2, "0");

const updateClock = () => {
  if (!clockElement) return;
  const date = new Date();
  clockElement.textContent = `${formatClockPart(date.getHours())}:${formatClockPart(date.getMinutes())}:${formatClockPart(date.getSeconds())}`;
};

updateClock();
window.setInterval(updateClock, 1000);

const setProgress = (value: number) => {
  fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
};

const getActiveChannelElement = () => channelElements[currentChannel] ?? null;

const destroyChannelScroller = () => {
  if (lenisRaf) {
    window.cancelAnimationFrame(lenisRaf);
    lenisRaf = 0;
  }
  channelLenis?.destroy();
  channelLenis = null;
};

const startLenisLoop = () => {
  if (!channelLenis || lenisRaf) return;
  const lenisFrame = (time: number) => {
    channelLenis?.raf(time);
    if (channelLenis) lenisRaf = window.requestAnimationFrame(lenisFrame);
  };
  lenisRaf = window.requestAnimationFrame(lenisFrame);
};

const syncChannelScroller = () => {
  destroyChannelScroller();
  if (computeLowPowerMode()) return;
  const channel = getActiveChannelElement();
  const content = channel?.querySelector<HTMLElement>(".section-shell, .hero");
  if (!channel || !content || channel.scrollHeight <= channel.clientHeight + 2) return;

  channelLenis = new Lenis({
    wrapper: channel,
    content,
    duration: 0.9,
    smoothWheel: true,
    syncTouch: false,
  });
  startLenisLoop();
};

const flushChannelDwell = (reason: string) => {
  const durationMs = Math.round(performance.now() - channelDwellStartedAt);
  track("channel_dwell", {
    channel: channels[currentChannel]?.number ?? String(currentChannel),
    name: channels[currentChannel]?.name ?? "UNKNOWN",
    duration_ms: durationMs,
    max_scroll_depth: activeChannelMaxScroll,
    scrolled: activeChannelHasScrolled,
    reason,
  });
  channelDwellStartedAt = performance.now();
  activeChannelMaxScroll = 0;
  activeChannelHasScrolled = false;
  trackedChannelScrollMilestones.clear();
  updateDebugMetric("max_channel_scroll", "0%");
};

const updateHistory = (index: number) => {
  const nextHash = channels[index]?.hash ?? "#home";
  if (window.location.hash === nextHash) return;
  window.history.replaceState(null, "", nextHash);
};

const animateChannelEntry = (index: number) => {
  if (reducedMotionQuery.matches) return;
  const channel = channelElements[index];
  if (!channel) return;
  const revealTargets = channel.querySelectorAll<HTMLElement>(
    ".section-heading, .reveal-card, .contact-copy, .form, .proof-strip",
  );
  if (!revealTargets.length) return;

  gsap.fromTo(
    revealTargets,
    { autoAlpha: 0, y: 18, filter: "blur(6px)" },
    {
      autoAlpha: 1,
      y: 0,
      filter: "blur(0px)",
      duration: 0.58,
      ease: "power3.out",
      stagger: 0.055,
      overwrite: true,
    },
  );
};

const setChannelState = (index: number) => {
  currentChannel = index;
  channelElements.forEach((channel, channelIndex) => {
    const active = channelIndex === currentChannel;
    channel.hidden = !active;
    channel.setAttribute("aria-hidden", String(!active));
    if (active) channel.scrollTo({ top: 0, behavior: "auto" });
  });
  navButtons.forEach((button) => {
    const indexValue = Number(button.dataset.goto);
    const active = indexValue === currentChannel;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  const definition = channels[currentChannel];
  chNum.textContent = definition?.number ?? "Home";
  chName.textContent = definition?.name ?? "Landing Page";
  updateHistory(currentChannel);
  updateDebugMetric("channel", `${definition?.number ?? ""} ${definition?.name ?? ""}`);
  setProgress(100);
  window.requestAnimationFrame(syncChannelScroller);
  animateChannelEntry(currentChannel);
};

const playChannelTransition = (channelLabel: string, nextState: () => void) =>
  new Promise<void>((resolve) => {
    if (transitionLabel) transitionLabel.textContent = channelLabel;

    if (!transitionOverlay) {
      nextState();
      resolve();
      return;
    }

    screen.classList.add("is-resolving");
    transitionOverlay.classList.remove("active");
    void transitionOverlay.offsetWidth;
    transitionOverlay.classList.add("active");

    const switchDelay = reducedMotionQuery.matches ? 80 : 220;
    const totalDelay = reducedMotionQuery.matches ? 250 : 780;

    globalThis.setTimeout(nextState, switchDelay);
    globalThis.setTimeout(() => {
      transitionOverlay.classList.remove("active");
      screen.classList.remove("is-resolving");
      resolve();
    }, totalDelay);
  });

const go = async (index: number, source: ChannelSource = "nav") => {
  if (switching || index === currentChannel || index < 0 || index >= channels.length) return;
  switching = true;
  flushChannelDwell("channel_exit");
  const nextChannel = channels[index];
  await playChannelTransition(nextChannel?.name ?? "Landing Page", () => {
    setChannelState(index);
  });
  channelDwellStartedAt = performance.now();
  track("channel_viewed", {
    channel: channels[index]?.number ?? String(index),
    name: channels[index]?.name ?? "",
    source,
  });
  switching = false;
};

const initHeroMotion = () => {
  if (heroMotionStarted) return;
  heroMotionStarted = true;

  const heroLines = gsap.utils.toArray<HTMLElement>("[data-hero-line]");
  const assemblePieces = gsap.utils.toArray<HTMLElement>(".assemble-piece");
  const proofItems = gsap.utils.toArray<HTMLElement>(".proof-strip span");
  const signalLock = document.querySelector<HTMLElement>(".signal-lock");
  const signalText = signalLock?.querySelector<HTMLElement>("strong");

  if (reducedMotionQuery.matches) {
    gsap.set(heroLines, { autoAlpha: 1, clearProps: "transform,filter" });
    gsap.set(assemblePieces, { autoAlpha: 1, clearProps: "transform,filter" });
    gsap.set(proofItems, { autoAlpha: 1, clearProps: "transform,filter" });
    signalLock?.classList.add("is-locked");
    if (signalText) signalText.textContent = "Signal locked";
    track("hero_assembly_completed", { duration_ms: 0 });
    return;
  }

  const mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    gsap.set(heroLines, { autoAlpha: 1, clearProps: "transform,filter" });

    const screenRect = screen.getBoundingClientRect();
    const driftStates = assemblePieces.map((piece) => {
      const pieceRect = piece.getBoundingClientRect();
      const finalX = pieceRect.left - screenRect.left;
      const finalY = pieceRect.top - screenRect.top;
      const maxX = Math.max(18, screenRect.width - pieceRect.width - 18);
      const maxY = Math.max(18, screenRect.height - pieceRect.height - 18);
      const startX = gsap.utils.random(18, maxX);
      const startY = gsap.utils.random(18, maxY);
      return {
        x: startX - finalX,
        y: startY - finalY,
        driftX: startX - finalX + gsap.utils.random(-34, 34),
        driftY: startY - finalY + gsap.utils.random(-26, 26),
        rotation: gsap.utils.random(-16, 16),
        driftRotation: gsap.utils.random(-20, 20),
      };
    });

    gsap.set(assemblePieces, {
      autoAlpha: 0.88,
      x: (index) => driftStates[index]?.x ?? 0,
      y: (index) => driftStates[index]?.y ?? 0,
      rotation: (index) => driftStates[index]?.rotation ?? 0,
      filter: "blur(1.2px)",
    });
    gsap.set(proofItems, {
      autoAlpha: 0,
      y: 10,
      filter: "blur(4px)",
    });
    gsap.set(signalLock, { autoAlpha: 0, y: -8 });
    if (signalText) signalText.textContent = "Signal scattered";

    const timeline = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: () => track("hero_assembly_completed", { duration_ms: 2600 }),
    });

    timeline
      .to(signalLock, {
        autoAlpha: 1,
        y: 0,
        duration: 0.28,
      })
      .to(
        assemblePieces,
        {
          autoAlpha: 1,
          x: (index) => driftStates[index]?.driftX ?? 0,
          y: (index) => driftStates[index]?.driftY ?? 0,
          rotation: (index) => driftStates[index]?.driftRotation ?? 0,
          filter: "blur(0.8px)",
          duration: 0.95,
          ease: "sine.inOut",
          stagger: {
            amount: 0.22,
            from: "random",
          },
        },
        0.08,
      )
      .call(() => {
        if (signalText) signalText.textContent = "Signal locking";
      }, undefined, 0.72)
      .to(
        assemblePieces,
        {
          autoAlpha: 1,
          x: 0,
          y: 0,
          rotation: 0,
          filter: "blur(0px)",
          duration: 1.18,
          ease: "expo.out",
          stagger: {
            amount: 0.44,
            from: "random",
          },
        },
        0.95,
      )
      .call(() => {
        signalLock?.classList.add("is-locked");
        if (signalText) signalText.textContent = "Signal locked";
      }, undefined, "-=0.24")
      .to(
        proofItems,
        {
          autoAlpha: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.46,
          stagger: 0.06,
        },
        "-=0.32",
      )
      .set(assemblePieces, { clearProps: "transform,filter,opacity,visibility" });

    return () => {
      timeline.kill();
      gsap.killTweensOf([...heroLines, ...assemblePieces, ...proofItems, signalLock].filter(Boolean));
    };
  });
};

setChannelState(currentChannel);
setProgress(100);
initHeroMotion();
track("channel_viewed", {
  channel: channels[currentChannel]?.number ?? String(currentChannel),
  name: channels[currentChannel]?.name ?? "",
  source: window.location.hash ? "hash" : "nav",
});

gotoControls.forEach((control) => {
  control.addEventListener("click", (event) => {
    const index = Number(control.dataset.goto);
    if (!Number.isFinite(index)) return;
    event.preventDefault();
    const source: ChannelSource = control.closest(".hero") ? "hero_cta" : "nav";
    if (source === "hero_cta") {
      track("cta_clicked", {
        location: "hero",
        target_channel: index,
      });
    }
    void go(index, source);
  });
});

window.addEventListener("hashchange", () => {
  const targetChannel = hashChannels[window.location.hash];
  if (targetChannel === undefined) return;
  void go(targetChannel, "hash");
});

const canScrollInDirection = (deltaY: number) => {
  const channel = getActiveChannelElement();
  if (!channel || channel.scrollHeight <= channel.clientHeight + 2) return false;
  if (deltaY > 0) {
    return channel.scrollTop + channel.clientHeight < channel.scrollHeight - 2;
  }
  return channel.scrollTop > 2;
};

window.addEventListener(
  "wheel",
  (event) => {
    if (canScrollInDirection(event.deltaY)) return;
    const now = Date.now();
    if (now - lastWheelAt < 720) return;
    lastWheelAt = now;
    const next = event.deltaY > 0
      ? Math.min(currentChannel + 1, channels.length - 1)
      : Math.max(currentChannel - 1, 0);
    void go(next, "wheel");
  },
  { passive: true },
);

window.addEventListener(
  "touchstart",
  (event) => {
    touchStartX = event.touches[0]?.clientX ?? 0;
    touchStartY = event.touches[0]?.clientY ?? 0;
  },
  { passive: true },
);

window.addEventListener(
  "touchend",
  (event) => {
    const endX = event.changedTouches[0]?.clientX ?? touchStartX;
    const endY = event.changedTouches[0]?.clientY ?? touchStartY;
    const deltaX = touchStartX - endX;
    const deltaY = touchStartY - endY;
    const horizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 45;
    const verticalAtBoundary = Math.abs(deltaY) > 60 && !canScrollInDirection(deltaY);
    if (!horizontalSwipe && !verticalAtBoundary) return;

    const delta = horizontalSwipe ? deltaX : deltaY;
    const next = delta > 0
      ? Math.min(currentChannel + 1, channels.length - 1)
      : Math.max(currentChannel - 1, 0);
    void go(next, "touch");
  },
  { passive: true },
);

window.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.matches("input, textarea, button, a, select")) return;

  if (/^[1-4]$/.test(event.key)) {
    event.preventDefault();
    void go(Number(event.key) - 1, "keyboard");
    return;
  }

  if (event.key === "ArrowRight") void go(Math.min(currentChannel + 1, channels.length - 1), "keyboard");
  if (event.key === "ArrowLeft") void go(Math.max(currentChannel - 1, 0), "keyboard");
  if (event.key === "ArrowDown" && !canScrollInDirection(1)) {
    void go(Math.min(currentChannel + 1, channels.length - 1), "keyboard");
  }
  if (event.key === "ArrowUp" && !canScrollInDirection(-1)) {
    void go(Math.max(currentChannel - 1, 0), "keyboard");
  }
});

channelElements.forEach((channel, index) => {
  let scrollQueued = false;
  channel.addEventListener(
    "scroll",
    () => {
      if (index !== currentChannel || scrollQueued) return;
      scrollQueued = true;
      window.requestAnimationFrame(() => {
        scrollQueued = false;
        const scrollable = channel.scrollHeight - channel.clientHeight;
        if (scrollable <= 0) return;
        const depth = Math.min(100, Math.round((channel.scrollTop / scrollable) * 100));
        if (!activeChannelHasScrolled && channel.scrollTop > 4) {
          activeChannelHasScrolled = true;
          track("channel_scroll_started", {
            channel: channels[currentChannel]?.number ?? String(currentChannel),
          });
        }
        if (depth > activeChannelMaxScroll) {
          activeChannelMaxScroll = depth;
          updateDebugMetric("max_channel_scroll", `${depth}%`);
          [25, 50, 75, 100].forEach((milestone) => {
            if (depth < milestone || trackedChannelScrollMilestones.has(milestone)) return;
            trackedChannelScrollMilestones.add(milestone);
            track("channel_scroll_depth", {
              channel: channels[currentChannel]?.number ?? String(currentChannel),
              depth_percent: milestone,
            });
          });
        }
      });
    },
    { passive: true },
  );
});

let resizeTimer = 0;
window.addEventListener(
  "resize",
  () => {
    globalThis.clearTimeout(resizeTimer);
    resizeTimer = globalThis.setTimeout(() => {
      updateDebugMetric("low_power_mode", computeLowPowerMode());
      syncChannelScroller();
    }, 180);
  },
  { passive: true },
);

document.querySelectorAll<HTMLImageElement>("[data-logo]").forEach((logo) => {
  logo.addEventListener("error", () => logo.classList.add("is-broken"));
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

  const setStatus = (message: string, type: "idle" | "success" | "error" = "idle") => {
    status.textContent = message;
    status.classList.remove("is-success", "is-error");
    if (type === "success") status.classList.add("is-success");
    if (type === "error") status.classList.add("is-error");
  };

  resetStartedAt();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    track("contact_form_submitted", {
      has_name: Boolean(String(formData.get("name") ?? "").trim()),
      has_email: Boolean(String(formData.get("email") ?? "").trim()),
    });

    if (!form.checkValidity()) {
      form.reportValidity();
      setStatus("Please complete the required fields.", "error");
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
    setStatus("Sending signal...");

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
      setStatus("Signal received - thanks.", "success");
      track("contact_form_success");
    } catch (error) {
      const statusCode = error instanceof Error && "status" in error
        ? Number((error as Error & { status?: number }).status) || "network"
        : "network";
      setStatus("Signal interrupted. Please try again in a moment.", "error");
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
      channel: channels[currentChannel]?.number ?? String(currentChannel),
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
    destroyChannelScroller();
    track("page_hidden", {
      visible_duration_ms: getVisibleDurationMs(),
      active_channel: channels[currentChannel]?.number ?? String(currentChannel),
    });
    return;
  }

  visibleStartedAt = performance.now();
  channelDwellStartedAt = performance.now();
  syncChannelScroller();
  track("page_visible", {
    visible_duration_ms: getVisibleDurationMs(),
    active_channel: channels[currentChannel]?.number ?? String(currentChannel),
  });
});

window.setInterval(() => {
  if (document.visibilityState !== "visible") return;
  track("engagement_heartbeat", {
    visible_duration_ms: getVisibleDurationMs(),
    active_channel: channels[currentChannel]?.number ?? String(currentChannel),
    channel_scroll_depth: activeChannelMaxScroll,
    scrolled: activeChannelHasScrolled,
  });
}, 30_000);

window.addEventListener("pagehide", () => {
  pauseVisibleTimer();
  flushChannelDwell("session_end");
  track("session_ended", {
    duration_ms: Math.round(performance.now() - sessionStartedAt),
    visible_duration_ms: getVisibleDurationMs(),
    final_channel: channels[currentChannel]?.number ?? String(currentChannel),
  });
});

window.addEventListener("load", () => {
  window.requestAnimationFrame(syncChannelScroller);
  scheduleIdle(initAnalyticsProvider, 900);
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
