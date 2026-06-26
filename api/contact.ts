import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";

declare const process: {
  env: Record<string, string | undefined>;
};

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  website?: unknown;
  startedAt?: unknown;
};

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  status: (statusCode: number) => ApiResponse;
  setHeader: (name: string, value: string) => ApiResponse;
  json: (body: Record<string, unknown>) => void;
};

const PRIMARY_ALLOWED_ORIGIN = "https://webport-mu-seven.vercel.app";
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const requestTimestamps = new Map<string, number[]>();
type RateLimitDecision = "allowed" | "limited" | "unavailable";

const sendJson = (
  response: ApiResponse,
  body: Record<string, unknown>,
  statusCode = 200,
  requestId?: string,
) => {
  response.setHeader("Cache-Control", "no-store");
  if (requestId) response.setHeader("X-Request-Id", requestId);
  response.status(statusCode).json(body);
};

const createRequestId = () =>
  `contact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const logContactWarning = (
  requestId: string,
  message: string,
  detail?: Record<string, unknown>,
) => {
  console.warn("[contact]", { level: "warning", requestId, message, ...detail });
};

const logContactError = (
  requestId: string,
  message: string,
  detail?: Record<string, unknown>,
) => {
  console.error("[contact]", { level: "error", requestId, message, ...detail });
};

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;

const getAllowedOrigins = () =>
  new Set(
    [
      PRIMARY_ALLOWED_ORIGIN,
      ...(process.env.CONTACT_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ].map((origin) => origin.replace(/\/$/, "")),
  );

const getHeader = (headers: ApiRequest["headers"], name: string) => {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const readPayload = (body: unknown): ContactPayload | null => {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as ContactPayload;
    } catch {
      return null;
    }
  }

  if (body && typeof body === "object") return body as ContactPayload;
  return null;
};

const getClientIp = (headers: ApiRequest["headers"]) =>
  (getHeader(headers, "x-forwarded-for") ?? "unknown").split(",")[0]?.trim() || "unknown";

const isAllowedOrigin = (origin: string) => {
  try {
    const { hostname, origin: normalizedOrigin } = new URL(origin);
    if (getAllowedOrigins().has(normalizedOrigin)) return true;
    if (
      process.env.VERCEL_ENV !== "production" &&
      (hostname === "localhost" || hostname === "127.0.0.1")
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
};

const validatePayload = (payload: ContactPayload) => {
  const name = clean(payload.name);
  const email = clean(payload.email).toLowerCase();
  const subject = clean(payload.subject);
  const message = clean(payload.message);
  const website = clean(payload.website);
  const startedAt = Number(payload.startedAt ?? 0);

  if (
    !name ||
    name.length > 100 ||
    !isValidEmail(email) ||
    !subject ||
    subject.length > 160 ||
    !message ||
    message.length > 2_000
  ) {
    return null;
  }

  return { email, message, name, startedAt, subject, website };
};

const isRateLimited = (clientIp: string) => {
  const now = Date.now();
  const recent = (requestTimestamps.get(clientIp) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (requestTimestamps.size > 1_000) {
    for (const [ip, timestamps] of requestTimestamps) {
      const active = timestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
      if (active.length) requestTimestamps.set(ip, active);
      else requestTimestamps.delete(ip);
    }
  }

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestTimestamps.set(clientIp, recent);
    return true;
  }

  recent.push(now);
  requestTimestamps.set(clientIp, recent);
  return false;
};

const requiresDurableRateLimit = () =>
  process.env.CONTACT_REQUIRE_DURABLE_RATE_LIMIT === "true" ||
  (
    process.env.VERCEL_ENV === "production" &&
    process.env.CONTACT_ALLOW_MEMORY_RATE_LIMIT !== "true"
  );

const getDurableRateLimiter = (() => {
  let limiter: Ratelimit | null | undefined;

  return () => {
    if (limiter !== undefined) return limiter;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      limiter = null;
      return limiter;
    }

    limiter = new Ratelimit({
      redis: new Redis({ url, token, enableTelemetry: false }),
      limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX_REQUESTS, "1 h"),
      analytics: true,
      enableProtection: true,
      ephemeralCache: new Map(),
      prefix: "@benxu/webport/contact",
      timeout: 1_500,
    });

    return limiter;
  };
})();

const applyRateLimit = async (
  clientIp: string,
  requestId: string,
  response: ApiResponse,
) : Promise<RateLimitDecision> => {
  const durableLimiter = getDurableRateLimiter();

  if (durableLimiter) {
    try {
      const result = await durableLimiter.limit(clientIp);
      response.setHeader("X-RateLimit-Limit", String(result.limit));
      response.setHeader("X-RateLimit-Policy", "upstash");
      response.setHeader("X-RateLimit-Remaining", String(Math.max(0, result.remaining)));
      response.setHeader("X-RateLimit-Reset", String(result.reset));

      if (!result.success) {
        response.setHeader(
          "Retry-After",
          String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))),
        );
        return "limited";
      }

      return "allowed";
    } catch (error) {
      logContactWarning(requestId, "durable rate limiter failed; using memory fallback", {
        error: error instanceof Error ? error.message : String(error),
      });

      if (requiresDurableRateLimit()) {
        response.setHeader("X-RateLimit-Policy", "upstash-unavailable");
        return "unavailable";
      }
    }
  }

  if (!durableLimiter && requiresDurableRateLimit()) {
    response.setHeader("X-RateLimit-Policy", "missing-upstash");
    logContactError(requestId, "durable rate limiter is required but not configured");
    return "unavailable";
  }

  response.setHeader("X-RateLimit-Limit", String(RATE_LIMIT_MAX_REQUESTS));
  response.setHeader("X-RateLimit-Policy", "memory-fallback");
  if (isRateLimited(clientIp)) {
    response.setHeader("Retry-After", String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
    return "limited";
  }

  return "allowed";
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const requestId = createRequestId();
  response.setHeader("X-Request-Id", requestId);

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, { ok: false, error: "Method not allowed.", requestId }, 405, requestId);
    return;
  }

  const contentType = getHeader(request.headers, "content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    sendJson(
      response,
      { ok: false, error: "Content type must be application/json.", requestId },
      415,
      requestId,
    );
    return;
  }

  const origin = getHeader(request.headers, "origin");
  if (!origin || !isAllowedOrigin(origin)) {
    logContactWarning(requestId, "blocked invalid origin", { origin: origin ?? "missing" });
    sendJson(response, { ok: false, error: "Invalid request.", requestId }, 403, requestId);
    return;
  }

  const contentLength = Number(getHeader(request.headers, "content-length") ?? 0);
  if (contentLength > 10_000) {
    sendJson(response, { ok: false, error: "Message is too large.", requestId }, 413, requestId);
    return;
  }

  const payload = readPayload(request.body);
  if (!payload) {
    sendJson(response, { ok: false, error: "Invalid request.", requestId }, 400, requestId);
    return;
  }

  const validatedPayload = validatePayload(payload);
  if (!validatedPayload) {
    sendJson(
      response,
      { ok: false, error: "Please check the form fields.", requestId },
      400,
      requestId,
    );
    return;
  }

  const { email, message, name, startedAt, subject, website } = validatedPayload;

  if (website) {
    logContactWarning(requestId, "honeypot field was populated");
    sendJson(response, { ok: false, error: "Invalid request.", requestId }, 400, requestId);
    return;
  }

  const rateLimitDecision = await applyRateLimit(getClientIp(request.headers), requestId, response);
  if (rateLimitDecision === "unavailable") {
    sendJson(
      response,
      { ok: false, error: "Contact delivery is temporarily unavailable.", requestId },
      503,
      requestId,
    );
    return;
  }

  if (rateLimitDecision === "limited") {
    sendJson(
      response,
      { ok: false, error: "Too many requests. Please try again later.", requestId },
      429,
      requestId,
    );
    return;
  }

  if (!Number.isFinite(startedAt) || Date.now() - startedAt < 1_200) {
    sendJson(
      response,
      { ok: false, error: "Please wait a moment and try again.", requestId },
      400,
      requestId,
    );
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL ?? "Ben Xu Portfolio <onboarding@resend.dev>";

  if (!apiKey || !to) {
    logContactError(requestId, "missing Resend delivery environment");
    sendJson(
      response,
      { ok: false, error: "Contact delivery is temporarily unavailable.", requestId },
      503,
      requestId,
    );
    return;
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");
  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from,
      to: [to],
      replyTo: email,
      subject: `[Portfolio] ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`,
      html: `
        <h2>New portfolio inquiry</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <hr />
        <p>${safeMessage}</p>
      `,
    });

    if (error) {
      logContactError(requestId, "Resend returned an error", {
        error: "message" in error ? error.message : String(error),
      });
      sendJson(response, { ok: false, error: "Email delivery failed.", requestId }, 500, requestId);
      return;
    }
  } catch (error) {
    logContactError(requestId, "Resend request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    sendJson(response, { ok: false, error: "Email delivery failed.", requestId }, 500, requestId);
    return;
  }

  sendJson(response, { ok: true, requestId }, 200, requestId);
}
