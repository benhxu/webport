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

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, { success: false, message: "Method not allowed." }, 405);
    return;
  }

  const origin = getHeader(request.headers, "origin");
  const host = getHeader(request.headers, "host");
  if (origin && host && new URL(origin).host !== host) {
    sendJson(response, { success: false, message: "Invalid request origin." }, 403);
    return;
  }

  const contentLength = Number(getHeader(request.headers, "content-length") ?? 0);
  if (contentLength > 20_000) {
    sendJson(response, { success: false, message: "Message is too large." }, 413);
    return;
  }

  const payload = readPayload(request.body);
  if (!payload) {
    sendJson(response, { success: false, message: "Invalid request." }, 400);
    return;
  }

  const name = clean(payload.name);
  const email = clean(payload.email).toLowerCase();
  const subject = clean(payload.subject);
  const message = clean(payload.message);
  const website = clean(payload.website);
  const startedAt = Number(payload.startedAt ?? 0);

  // Honeypot submissions receive a success response without sending email.
  if (website) {
    sendJson(response, { success: true });
    return;
  }

  if (
    !name ||
    name.length > 100 ||
    !isValidEmail(email) ||
    !subject ||
    subject.length > 160 ||
    !message ||
    message.length > 5_000
  ) {
    sendJson(response, { success: false, message: "Please check the form fields." }, 400);
    return;
  }

  if (!Number.isFinite(startedAt) || Date.now() - startedAt < 1_200) {
    sendJson(response, { success: false, message: "Please wait a moment and try again." }, 400);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL ?? "Ben Xu Portfolio <onboarding@resend.dev>";

  if (!apiKey || !to) {
    sendJson(response, { success: false, message: "Contact delivery is not configured." }, 503);
    return;
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
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
      }),
    });

    if (!resendResponse.ok) {
      sendJson(response, { success: false, message: "Email delivery failed." }, 502);
      return;
    }
  } catch {
    sendJson(response, { success: false, message: "Email delivery failed." }, 502);
    return;
  }

  sendJson(response, { success: true });
}
