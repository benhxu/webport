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
type ChannelDefinition = readonly [number: string, name: string, duration: number];

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
  const reducedMotion = reducedMotionQuery.matches;
  const hardwareConcurrency = navigator.hardwareConcurrency || 8;
  const deviceMemory = "deviceMemory" in navigator
    ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0)
    : 0;
  return isMobile || reducedMotion || hardwareConcurrency <= 4 || (deviceMemory > 0 && deviceMemory <= 4);
};

const debugMetrics: Record<string, DebugValue> = {
  low_power_mode: computeLowPowerMode(),
  channel: "01 SIGNAL",
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
const flash = document.querySelector<HTMLElement>("#flash");
const fill = document.querySelector<HTMLElement>("#fill");
const chNum = document.querySelector<HTMLElement>("#chNum");
const chName = document.querySelector<HTMLElement>("#chName");
const clockElement = document.querySelector<HTMLElement>("#clock");
const channelKnob = document.querySelector<HTMLElement>("#channelKnob");
const signalLock = document.querySelector<HTMLElement>("#signalLock");
const hero = document.querySelector<HTMLElement>("#hero");
const channelElements = Array.from(document.querySelectorAll<HTMLElement>(".channel"));
const navButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".nav [data-goto]"));
const gotoControls = Array.from(document.querySelectorAll<HTMLElement>("[data-goto]"));

if (!screen || !flash || !fill || !chNum || !chName || !hero || !signalLock) {
  throw new Error("Required TV interface elements are missing.");
}

const channels = [
  ["01", "SIGNAL", 9500],
  ["02", "PROFILE", 10000],
  ["03", "WORK RECORD", 12000],
  ["04", "OPEN LINE", Number.POSITIVE_INFINITY],
] as const satisfies readonly ChannelDefinition[];

const hashChannels: Record<string, number> = {
  "#home": 0,
  "#signal": 0,
  "#about": 1,
  "#profile": 1,
  "#experience": 2,
  "#work-record": 2,
  "#contact": 3,
  "#open-line": 3,
};

let currentChannel = hashChannels[window.location.hash] ?? 0;
let autoplayEnabled = currentChannel === 0;
let progressTimer = 0;
let progressRaf = 0;
let progressStartedAt = 0;
let switching = false;
let channelLenis: Lenis | null = null;
let channelDwellStartedAt = performance.now();
let lastWheelAt = 0;
let touchStartX = 0;
let touchStartY = 0;
let activeChannelMaxScroll = 0;
let activeChannelHasScrolled = false;
let assemblyStarted = false;
const trackedChannelScrollMilestones = new Set<number>();

const formatClockPart = (value: number) => String(value).padStart(2, "0");

const updateClock = () => {
  if (!clockElement) return;
  const date = new Date();
  clockElement.textContent = `${formatClockPart(date.getHours())}:${formatClockPart(date.getMinutes())}:${formatClockPart(date.getSeconds())}`;
};

updateClock();
window.setInterval(updateClock, 1000);

const flashStatic = () =>
  new Promise<void>((resolve) => {
    const frames = [0.22, 0.9, 0.08, 0.7, 0.02, 0.35, 0];
    let index = 0;
    const frame = () => {
      flash.style.opacity = String(frames[index++] ?? 0);
      if (index < frames.length) globalThis.setTimeout(frame, 45);
      else resolve();
    };
    frame();
  });

const stopProgress = () => {
  globalThis.clearTimeout(progressTimer);
  window.cancelAnimationFrame(progressRaf);
  fill.style.width = "0%";
};

const startProgress = () => {
  stopProgress();
  if (!autoplayEnabled) {
    fill.style.width = "100%";
    return;
  }
  const duration = channels[currentChannel]?.[2] ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(duration)) {
    fill.style.width = "100%";
    return;
  }

  progressStartedAt = performance.now();
  const step = (time: number) => {
    const progress = Math.min((time - progressStartedAt) / duration, 1);
    fill.style.width = `${progress * 100}%`;
    if (progress < 1) progressRaf = window.requestAnimationFrame(step);
  };
  progressRaf = window.requestAnimationFrame(step);
  progressTimer = globalThis.setTimeout(() => {
    void go(Math.min(currentChannel + 1, channels.length - 1), "auto");
  }, duration);
};

const getActiveChannelElement = () => channelElements[currentChannel] ?? null;

const destroyChannelScroller = () => {
  channelLenis?.destroy();
  channelLenis = null;
};

const syncChannelScroller = () => {
  destroyChannelScroller();
  const channel = getActiveChannelElement();
  const content = channel?.querySelector<HTMLElement>(".inner, .hero");
  if (!channel || !content || channel.scrollHeight <= channel.clientHeight + 2) return;

  channelLenis = new Lenis({
    wrapper: channel,
    content,
    duration: 1.1,
    smoothWheel: true,
    syncTouch: false,
  });
};

const lenisFrame = (time: number) => {
  channelLenis?.raf(time);
  window.requestAnimationFrame(lenisFrame);
};
window.requestAnimationFrame(lenisFrame);

const flushChannelDwell = (reason: string) => {
  const durationMs = Math.round(performance.now() - channelDwellStartedAt);
  track("channel_dwell", {
    channel: channels[currentChannel]?.[0] ?? String(currentChannel),
    name: channels[currentChannel]?.[1] ?? "UNKNOWN",
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
  const hashes = ["#home", "#about", "#experience", "#contact"];
  const nextHash = hashes[index] ?? "#home";
  if (window.location.hash === nextHash) return;
  window.history.replaceState(null, "", nextHash);
};

const setChannelState = (index: number) => {
  currentChannel = index;
  channelElements.forEach((channel, channelIndex) => {
    channel.hidden = channelIndex !== currentChannel;
    channel.setAttribute("aria-hidden", String(channelIndex !== currentChannel));
  });
  navButtons.forEach((button, buttonIndex) => {
    const active = buttonIndex === currentChannel;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  const definition = channels[currentChannel];
  chNum.textContent = definition?.[0] ?? "01";
  chName.textContent = definition?.[1] ?? "SIGNAL";
  if (channelKnob) channelKnob.style.transform = `rotate(${currentChannel * 42 + 18}deg)`;
  getActiveChannelElement()?.scrollTo({ top: 0, behavior: "auto" });
  updateHistory(currentChannel);
  updateDebugMetric("channel", `${definition?.[0] ?? ""} ${definition?.[1] ?? ""}`);
  window.requestAnimationFrame(syncChannelScroller);
};

const go = async (
  index: number,
  source: "nav" | "hero_cta" | "wheel" | "touch" | "keyboard" | "auto" | "hash" = "nav",
) => {
  if (switching || index === currentChannel || index < 0 || index >= channels.length) return;
  if (!["auto", "hash"].includes(source)) autoplayEnabled = false;
  switching = true;
  stopProgress();
  flushChannelDwell("channel_exit");
  await flashStatic();
  setChannelState(index);
  if (index === 0 && !assemblyStarted) {
    globalThis.setTimeout(setupAssembly, 450);
  }
  channelDwellStartedAt = performance.now();
  startProgress();
  track("channel_viewed", {
    channel: channels[index]?.[0] ?? String(index),
    name: channels[index]?.[1] ?? "",
    source,
  });
  switching = false;
};

setChannelState(currentChannel);
startProgress();
track("channel_viewed", {
  channel: channels[currentChannel]?.[0] ?? String(currentChannel),
  name: channels[currentChannel]?.[1] ?? "",
  source: window.location.hash ? "hash" : "nav",
});

gotoControls.forEach((control) => {
  control.addEventListener("click", () => {
    const index = Number(control.dataset.goto);
    const source = control.closest(".hero") ? "hero_cta" : "nav";
    autoplayEnabled = false;
    if (index === currentChannel) {
      stopProgress();
      fill.style.width = "100%";
    }
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
    if (now - lastWheelAt < 650) return;
    lastWheelAt = now;
    autoplayEnabled = false;
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

    autoplayEnabled = false;
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
  if (target?.matches("input, textarea, button, a")) return;
  if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) {
    autoplayEnabled = false;
  }
  if (event.key === "ArrowRight") void go(Math.min(currentChannel + 1, 3), "keyboard");
  if (event.key === "ArrowLeft") void go(Math.max(currentChannel - 1, 0), "keyboard");
  if (event.key === "ArrowDown" && !canScrollInDirection(1)) {
    void go(Math.min(currentChannel + 1, 3), "keyboard");
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
          autoplayEnabled = false;
          stopProgress();
          fill.style.width = "100%";
          track("channel_scroll_started", {
            channel: channels[currentChannel]?.[0] ?? String(currentChannel),
          });
        }
        if (depth > activeChannelMaxScroll) {
          activeChannelMaxScroll = depth;
          updateDebugMetric("max_channel_scroll", `${depth}%`);
          [25, 50, 75, 100].forEach((milestone) => {
            if (depth < milestone || trackedChannelScrollMilestones.has(milestone)) return;
            trackedChannelScrollMilestones.add(milestone);
            track("channel_scroll_depth", {
              channel: channels[currentChannel]?.[0] ?? String(currentChannel),
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
    resizeTimer = globalThis.setTimeout(syncChannelScroller, 160);
  },
  { passive: true },
);

type AssemblyParticle = {
  element: HTMLElement;
  targetX: number;
  targetY: number;
  baseX: number;
  baseY: number;
  angle: number;
  spin: number;
  velocityX: number;
  velocityY: number;
  phase: number;
  amplitude: number;
  snapX?: number;
  snapY?: number;
  snapAngle?: number;
};

type ChaosParticle = {
  element: HTMLElement;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  rotation: number;
  spin: number;
};

const assemblyPieces = Array.from(document.querySelectorAll<HTMLElement>(".assemble-piece"));
const chaosWords = [
  "manual monday",
  "copy paste",
  "who owns this?",
  "version_final_3",
  "missing owner",
  "update tracker",
  "RMA pending",
  "ask team",
  "no source",
  "out of sync",
  "spreadsheet tab 12",
  "TBD",
  "N/A",
  "handoff broke",
];
const DRIFT_MS = 1800;
const ASSEMBLE_MS = 2200;
let assemblyParticles: AssemblyParticle[] = [];
let chaosParticles: ChaosParticle[] = [];
let animationStartedAt = 0;
let assemblyRaf = 0;
let chaosRaf = 0;

const randomBetween = (minimum: number, maximum: number) =>
  minimum + Math.random() * Math.max(0, maximum - minimum);

const removeChaos = () => {
  window.cancelAnimationFrame(chaosRaf);
  chaosParticles.forEach((particle) => particle.element.remove());
  chaosParticles = [];
};

const spawnMess = () => {
  removeChaos();
  if (reducedMotionQuery.matches || currentChannel !== 0) return;

  const count = computeLowPowerMode() ? 12 : 24;
  for (let index = 0; index < count; index += 1) {
    const element = document.createElement("span");
    element.className = `chaos-word${Math.random() > 0.68 ? " gold" : ""}`;
    element.textContent = chaosWords[Math.floor(Math.random() * chaosWords.length)] ?? "out of sync";
    screen.append(element);
    chaosParticles.push({
      element,
      x: randomBetween(20, Math.max(21, screen.clientWidth - 160)),
      y: randomBetween(25, Math.max(26, screen.clientHeight - 40)),
      velocityX: randomBetween(-0.22, 0.22),
      velocityY: randomBetween(-0.18, 0.18),
      rotation: randomBetween(-12, 12),
      spin: randomBetween(-0.08, 0.08),
    });
  }

  const animateChaos = () => {
    if (document.visibilityState === "visible" && currentChannel === 0) {
      chaosParticles.forEach((particle) => {
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        particle.rotation += particle.spin;
        if (particle.x < 0 || particle.x > screen.clientWidth - 140) particle.velocityX *= -1;
        if (particle.y < 0 || particle.y > screen.clientHeight - 28) particle.velocityY *= -1;
        particle.element.style.transform =
          `translate3d(${particle.x}px, ${particle.y}px, 0) rotate(${particle.rotation}deg)`;
      });
    }
    chaosRaf = window.requestAnimationFrame(animateChaos);
  };
  chaosRaf = window.requestAnimationFrame(animateChaos);
};

const settleAssembly = () => {
  window.cancelAnimationFrame(assemblyRaf);
  hero.classList.remove("assembling");
  hero.classList.add("assembled");
  assemblyPieces.forEach((element) => {
    element.style.transform = "";
    element.style.opacity = "";
    element.style.filter = "";
  });
  signalLock.textContent = "signal locked · ready";
  removeChaos();
  track("hero_assembly_completed", {
    duration_ms: reducedMotionQuery.matches ? 0 : DRIFT_MS + ASSEMBLE_MS,
  });
};

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

const animateAssembly = (now: number) => {
  const elapsed = now - animationStartedAt;
  const screenRect = screen.getBoundingClientRect();

  if (elapsed < DRIFT_MS) {
    assemblyParticles.forEach((particle) => {
      particle.baseX += particle.velocityX;
      particle.baseY += particle.velocityY;
      particle.angle += particle.spin;
      const currentX = particle.targetX + particle.baseX;
      const currentY = particle.targetY + particle.baseY;
      if (currentX < 18 || currentX > screenRect.width - 120) {
        particle.velocityX *= -1;
        particle.baseX += particle.velocityX * 5;
      }
      if (currentY < 24 || currentY > screenRect.height - 60) {
        particle.velocityY *= -1;
        particle.baseY += particle.velocityY * 5;
      }
      const wobbleX = Math.sin(elapsed / 520 + particle.phase) * particle.amplitude;
      const wobbleY = Math.cos(elapsed / 670 + particle.phase) * particle.amplitude * 0.65;
      const x = particle.baseX + wobbleX;
      const y = particle.baseY + wobbleY;
      particle.element.dataset.tx = String(x);
      particle.element.dataset.ty = String(y);
      particle.element.style.transform =
        `translate3d(${x}px, ${y}px, 0) rotate(${particle.angle}deg)`;
      particle.element.style.opacity = "0.92";
      particle.element.style.filter = "blur(0.1px)";
    });
    signalLock.textContent = "30+ workflows in motion · assembling shortly";
    assemblyRaf = window.requestAnimationFrame(animateAssembly);
    return;
  }

  const progress = Math.min((elapsed - DRIFT_MS) / ASSEMBLE_MS, 1);
  const eased = easeOutCubic(progress);
  assemblyParticles.forEach((particle) => {
    if (particle.snapX === undefined) {
      particle.snapX = Number(particle.element.dataset.tx) || particle.baseX;
      particle.snapY = Number(particle.element.dataset.ty) || particle.baseY;
      particle.snapAngle = particle.angle;
    }
    const x = particle.snapX * (1 - eased);
    const y = (particle.snapY ?? 0) * (1 - eased);
    const angle = (particle.snapAngle ?? 0) * (1 - eased);
    particle.element.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg)`;
    particle.element.style.opacity = "1";
    particle.element.style.filter = progress > 0.72 ? "none" : "blur(0.1px)";
  });
  signalLock.textContent =
    progress < 1 ? "signal locking · system coming online" : "signal locked · ready";

  if (progress < 1) {
    assemblyRaf = window.requestAnimationFrame(animateAssembly);
  } else {
    settleAssembly();
  }
};

const setupAssembly = () => {
  if (assemblyStarted || currentChannel !== 0) return;
  assemblyStarted = true;
  if (reducedMotionQuery.matches) {
    settleAssembly();
    return;
  }

  const screenRect = screen.getBoundingClientRect();
  assemblyParticles = assemblyPieces.map((element) => {
    const rect = element.getBoundingClientRect();
    const maximumX = Math.max(29, screenRect.width - rect.width - 28);
    const maximumY = Math.max(31, screenRect.height - rect.height - 30);
    const safeX = randomBetween(28, maximumX);
    const safeY = randomBetween(30, maximumY);
    const targetX = rect.left - screenRect.left;
    const targetY = rect.top - screenRect.top;
    const offsetX = safeX - targetX;
    const offsetY = safeY - targetY;
    return {
      element,
      targetX,
      targetY,
      baseX: offsetX,
      baseY: offsetY,
      angle: randomBetween(-36, 36),
      spin: randomBetween(-1.2, 1.2),
      velocityX: randomBetween(-0.45, 0.45),
      velocityY: randomBetween(-0.36, 0.36),
      phase: randomBetween(0, Math.PI * 2),
      amplitude: randomBetween(12, 34),
    };
  });
  hero.classList.add("assembling");
  spawnMess();
  animationStartedAt = performance.now();
  assemblyRaf = window.requestAnimationFrame(animateAssembly);
};

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
      setStatus("Message sent — I'll be in touch soon.", "success");
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
      setStatus("Signal received — thanks.", "success");
      track("contact_form_success");
    } catch (error) {
      const statusCode = error instanceof Error && "status" in error
        ? Number((error as Error & { status?: number }).status) || "network"
        : "network";
      setStatus("Signal interrupted. Try the Email or LinkedIn link.", "error");
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
      channel: channels[currentChannel]?.[0] ?? String(currentChannel),
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
    stopProgress();
    track("page_hidden", {
      visible_duration_ms: getVisibleDurationMs(),
      active_channel: channels[currentChannel]?.[0] ?? String(currentChannel),
    });
    return;
  }

  visibleStartedAt = performance.now();
  channelDwellStartedAt = performance.now();
  startProgress();
  track("page_visible", {
    visible_duration_ms: getVisibleDurationMs(),
    active_channel: channels[currentChannel]?.[0] ?? String(currentChannel),
  });
});

window.setInterval(() => {
  if (document.visibilityState !== "visible") return;
  track("engagement_heartbeat", {
    visible_duration_ms: getVisibleDurationMs(),
    active_channel: channels[currentChannel]?.[0] ?? String(currentChannel),
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
    final_channel: channels[currentChannel]?.[0] ?? String(currentChannel),
  });
});

window.addEventListener("load", () => {
  window.requestAnimationFrame(syncChannelScroller);
  if (currentChannel === 0) globalThis.setTimeout(setupAssembly, 450);

  track("site_loaded", {
    path: window.location.pathname,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    pointer: window.matchMedia("(pointer: coarse)").matches ? "coarse" : "fine",
    reduced_motion: reducedMotionQuery.matches,
    analytics_provider: POSTHOG_KEY ? "posthog" : ANALYTICS_ENDPOINT ? "custom" : "unconfigured",
  });

  scheduleIdle(() => {
    void initAnalyticsProvider();
  }, 1200);

  scheduleIdle(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (!navigation) return;
    track("performance_timing", {
      dom_content_loaded_ms: Math.round(navigation.domContentLoadedEventEnd),
      load_event_ms: Math.round(navigation.loadEventEnd),
      response_ms: Math.round(navigation.responseEnd),
      transfer_size: navigation.transferSize || null,
    });

    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    track("resource_summary", {
      resource_count: resources.length,
      transfer_size: resources.reduce(
        (total, resource) => total + (resource.transferSize || 0),
        0,
      ),
      script_count: resources.filter((resource) => resource.initiatorType === "script").length,
      image_count: resources.filter((resource) => resource.initiatorType === "img").length,
    });
  }, 1800);
});
