import { test, expect } from "@playwright/test";

test("Login should return token", async ({ request }) => {
  const res = await request.post("http://localhost:3001/auth/login", {
    data: { email: "qa@demo.com", password: "Password123" },
  });

  expect(res.ok()).toBeTruthy();
  const body = await res.json();

  expect(body.email).toBe("qa@demo.com");
  expect(body.token).toBeTruthy();
});
