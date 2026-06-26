const baseUrl = new URL(process.env.SMOKE_BASE_URL ?? "https://webport-mu-seven.vercel.app/");
const shouldSendEmail = process.env.SMOKE_SEND_EMAIL === "true";
const formspreeEndpoint =
  process.env.SMOKE_FORMSPREE_ENDPOINT ?? "https://formspree.io/f/mbdvorzn";

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

console.log(`Smoke testing ${baseUrl.toString()}`);

const pageResponse = await fetch(baseUrl, { method: "GET" });
if (pageResponse.status === 200) {
  pass("home page returns 200");
} else {
  fail(`home page expected 200 but received ${pageResponse.status}`);
}

expectHeader(pageResponse.headers, "cross-origin-resource-policy", "same-origin");
expectHeader(pageResponse.headers, "x-content-type-options", "nosniff");
expectHeader(pageResponse.headers, "x-frame-options", "DENY");

const csp = expectHeader(pageResponse.headers, "content-security-policy");
expectContains(csp, "style-src 'self'", "CSP has strict style-src");
expectNotContains(csp, "'unsafe-inline'", "CSP disallows inline styles");
expectContains(csp, "connect-src 'self' https://formspree.io", "CSP allows Formspree fetches");
expectContains(csp, "form-action 'self' https://formspree.io", "CSP allows Formspree form posts");
expectContains(csp, "frame-ancestors 'none'", "CSP blocks framing");

const html = await pageResponse.text();
expectContains(html, formspreeEndpoint, "contact form action uses Formspree");
expectNotContains(html, "/api/contact", "page no longer references local contact API");

if (shouldSendEmail) {
  const body = new FormData();
  body.set("name", "Codex Smoke Test");
  body.set("email", "smoke@example.com");
  body.set("subject", "Production contact smoke test");
  body.set("message", "This is a Formspree delivery smoke test from Codex.");
  body.set("_subject", "Production contact smoke test");

  const deliveryResponse = await fetch(formspreeEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    body,
  });
  const deliveryBody = await deliveryResponse.json().catch(() => null);

  if (deliveryResponse.ok && deliveryBody?.ok !== false) {
    pass("Formspree delivery smoke sent successfully");
  } else {
    fail(
      `Formspree delivery smoke expected success but received ${deliveryResponse.status}: ${
        deliveryBody?.errors?.[0]?.message ?? "unknown error"
      }`,
    );
  }
} else {
  console.log("SKIP contact delivery smoke; set SMOKE_SEND_EMAIL=true to send one test email.");
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log("Production smoke test passed.");
}
