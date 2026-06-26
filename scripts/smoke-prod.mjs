const baseUrl = new URL(process.env.SMOKE_BASE_URL ?? "https://webport-mu-seven.vercel.app/");
const apiUrl = new URL("/api/contact", baseUrl);

let failed = false;

const pass = (message) => {
  console.log(`PASS ${message}`);
};

const fail = (message) => {
  failed = true;
  console.error(`FAIL ${message}`);
};

const expectHeader = (headers, name, expectedValue) => {
  const value = headers.get(name);
  if (!value) {
    fail(`${name} header is missing`);
    return null;
  }

  if (expectedValue && value !== expectedValue) {
    fail(`${name} expected "${expectedValue}" but received "${value}"`);
    return value;
  }

  pass(`${name}: ${value}`);
  return value;
};

const expectContains = (value, needle, message) => {
  if (value?.includes(needle)) {
    pass(message);
    return;
  }

  fail(`${message} missing "${needle}"`);
};

const expectNotContains = (value, needle, message) => {
  if (value && !value.includes(needle)) {
    pass(message);
    return;
  }

  fail(`${message} still contains "${needle}"`);
};

console.log(`Smoke testing ${apiUrl.toString()}`);

const headResponse = await fetch(apiUrl, { method: "HEAD" });
if (headResponse.status === 405) {
  pass("HEAD /api/contact is blocked with 405");
} else {
  fail(`HEAD /api/contact expected 405 but received ${headResponse.status}`);
}

expectHeader(headResponse.headers, "x-request-id");
expectHeader(headResponse.headers, "cross-origin-resource-policy", "same-origin");
expectHeader(headResponse.headers, "x-content-type-options", "nosniff");
expectHeader(headResponse.headers, "x-frame-options", "DENY");
expectHeader(headResponse.headers, "cache-control", "no-store");

const csp = expectHeader(headResponse.headers, "content-security-policy");
expectContains(csp, "style-src 'self'", "CSP has strict style-src");
expectNotContains(csp, "'unsafe-inline'", "CSP disallows inline styles");
expectContains(csp, "frame-ancestors 'none'", "CSP blocks framing");

const timingResponse = await fetch(apiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: baseUrl.origin,
  },
  body: JSON.stringify({
    email: "smoke@example.com",
    message: "This should fail timing before email delivery.",
    name: "Smoke Test",
    startedAt: 1,
    subject: "Smoke test",
  }),
});

const rateLimitPolicy = timingResponse.headers.get("x-ratelimit-policy");
expectHeader(timingResponse.headers, "x-request-id");

if (timingResponse.status === 400 && rateLimitPolicy === "upstash") {
  pass("POST timing smoke reached durable Upstash rate limiter without sending email");
} else if (timingResponse.status === 503 && rateLimitPolicy === "missing-upstash") {
  fail("Upstash is required in production but missing from Vercel environment variables");
} else if (rateLimitPolicy === "memory-fallback") {
  fail("Production is using memory-fallback rate limiting");
} else {
  fail(
    `POST timing smoke expected 400/upstash but received ${timingResponse.status}/${rateLimitPolicy ?? "no-policy"}`,
  );
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log("Production smoke test passed.");
}
