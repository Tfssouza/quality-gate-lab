import { test, expect } from "@playwright/test";

test("API health should be OK", async ({ request }) => {
  const res = await request.get("http://localhost:3001/health");
  expect(res.ok()).toBeTruthy();

  const body = await res.json();
  expect(body.status).toBe("ok");
});
