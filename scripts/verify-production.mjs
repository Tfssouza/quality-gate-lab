import { fork } from "node:child_process";
import { mkdir, mkdtemp } from "node:fs/promises";
import { once } from "node:events";
import assert from "node:assert/strict";

await mkdir(".local", { recursive: true });
const dataDir = await mkdtemp(".local/production-check-");
const base = "http://127.0.0.1:3201";
// Never stop or replace another server occupying our verification port.
let occupied = false;
try {
  await fetch(`${base}/health`);
  occupied = true;
} catch {}
assert.equal(occupied, false, "Port 3201 must be free before verification");
let child;
async function start() {
  child = fork("apps/api/src/server.ts", [], {
    execArgv: ["--import", "tsx"],
    silent: true,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: "3201",
      HOST: "127.0.0.1",
      PGLITE_PATH: dataDir,
      TEST_MODE: "",
      DATABASE_URL: "",
    },
  });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`API exited with code ${child.exitCode}`);
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("API readiness timeout");
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const processExit = once(child, "exit");
  child.send("shutdown");
  const timeout = setTimeout(() => child.kill(), 10_000);
  try {
    await processExit;
  } finally {
    clearTimeout(timeout);
  }
}
async function login() {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "customer@example.test",
      password: "Customer-Demo-2026!",
    }),
  });
  assert.equal(res.status, 200);
  return (await res.json()).token;
}
try {
  await start();
  const smoke = fork("scripts/smoke.mjs", [base], { silent: true });
  smoke.stdout.pipe(process.stdout);
  smoke.stderr.pipe(process.stderr);
  assert.equal((await once(smoke, "exit"))[0], 0, "production smoke must pass");
  const token = await login();
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  const slot = (await (await fetch(`${base}/api/slots`, { headers })).json())
    .items[0];
  const booking = await fetch(`${base}/api/bookings`, {
    method: "POST",
    headers,
    body: JSON.stringify({ slotId: slot.id }),
  });
  assert.equal(booking.status, 201);
  const id = (await booking.json()).id;
  await stop();
  await start();
  assert.equal(
    (await fetch(`${base}/api/bookings`, { headers })).status,
    401,
    "sessions must expire on server restart",
  );
  const freshHeaders = { authorization: `Bearer ${await login()}` };
  const list = await (
    await fetch(`${base}/api/bookings`, { headers: freshHeaders })
  ).json();
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].id, id);
  console.log(
    "Production persistence passed: booking survives restart; old session is rejected.",
  );
} finally {
  await stop();
}
