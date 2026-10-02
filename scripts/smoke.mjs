import assert from "node:assert/strict";

const base = process.argv[2] || "http://127.0.0.1:3000";
const health = await fetch(`${base}/health`);
assert.equal(health.status, 200);
assert.equal((await health.json()).status, "ok");
const home = await fetch(base);
assert.equal(home.status, 200);
const html = await home.text();
assert.match(html, /Booking Studio/);
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)];
assert.ok(assets.length >= 2, "built JS and CSS assets must be referenced");
for (const [, path] of assets)
  assert.equal((await fetch(`${base}${path}`)).status, 200, path);
assert.equal(
  (await fetch(`${base}/__test/reset`, { method: "POST" })).status,
  404,
  "reset must be absent outside test mode",
);
const response = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    email: "customer@example.test",
    password: "Customer-Demo-2026!",
  }),
});
assert.equal(response.status, 200);
const { token } = await response.json();
const headers = { authorization: `Bearer ${token}` };
const slots = await fetch(`${base}/api/slots`, { headers });
assert.equal(slots.status, 200);
assert.ok((await slots.json()).items.length > 0, "seeded sessions must exist");
assert.equal(
  (await fetch(`${base}/api/auth/logout`, { method: "POST", headers })).status,
  204,
);
console.log(
  "Production smoke passed: assets, API, seed data and reset protection.",
);
