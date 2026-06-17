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
// Temporary serverless-friendly fallback. This protects warm instances, but a
// durable store such as Upstash Redis is the right upgrade for strict limits.
const requestTimestamps = new Map<string, number[]>();

const sendJson = (
  response: ApiResponse,
  body: Record<string, unknown>,
  statusCode = 200,
) => {
  response.setHeader("Cache-Control", "no-store");
  response.status(statusCode).json(body);
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

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, { ok: false, error: "Method not allowed." }, 405);
    return;
  }

  const contentType = getHeader(request.headers, "content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    sendJson(response, { ok: false, error: "Content type must be application/json." }, 415);
    return;
  }

  const origin = getHeader(request.headers, "origin");
  if (!origin || !isAllowedOrigin(origin)) {
    sendJson(response, { ok: false, error: "Invalid request." }, 403);
    return;
  }

  const contentLength = Number(getHeader(request.headers, "content-length") ?? 0);
  if (contentLength > 10_000) {
    sendJson(response, { ok: false, error: "Message is too large." }, 413);
    return;
  }

  const payload = readPayload(request.body);
  if (!payload) {
    sendJson(response, { ok: false, error: "Invalid request." }, 400);
    return;
  }

  const validatedPayload = validatePayload(payload);
  if (!validatedPayload) {
    sendJson(response, { ok: false, error: "Please check the form fields." }, 400);
    return;
  }

  const { email, message, name, startedAt, subject, website } = validatedPayload;

  if (website) {
    sendJson(response, { ok: false, error: "Invalid request." }, 400);
    return;
  }

  if (isRateLimited(getClientIp(request.headers))) {
    response.setHeader("Retry-After", String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
    sendJson(response, { ok: false, error: "Too many requests. Please try again later." }, 429);
    return;
  }

  if (!Number.isFinite(startedAt) || Date.now() - startedAt < 1_200) {
    sendJson(response, { ok: false, error: "Please wait a moment and try again." }, 400);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL ?? "Ben Xu Portfolio <onboarding@resend.dev>";

  if (!apiKey || !to) {
    sendJson(response, { ok: false, error: "Contact delivery is temporarily unavailable." }, 503);
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
      sendJson(response, { ok: false, error: "Email delivery failed." }, 500);
      return;
    }
  } catch {
    sendJson(response, { ok: false, error: "Email delivery failed." }, 500);
    return;
  }

  sendJson(response, { ok: true });
}
