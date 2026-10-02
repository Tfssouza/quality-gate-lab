import { test as base, expect, type APIRequestContext } from "@playwright/test";
import { demoAccounts } from "../../database/seeds/accounts";

export const API = "http://127.0.0.1:3101";
export const test = base.extend({
  request: async ({ request }, use) => {
    const reset = await request.post(`${API}/__test/reset`, {
      headers: { "x-test-reset-key": "isolated-test-fixtures" },
    });
    expect(reset.status(), "isolated test data must reset successfully").toBe(
      204,
    );
    await use(request);
  },
});
export { expect };
export async function login(
  request: APIRequestContext,
  role: "customer" | "operator" | "other" = "customer",
) {
  const account =
    demoAccounts[role === "customer" ? 0 : role === "other" ? 1 : 2];
  const res = await request.post(`${API}/api/auth/login`, {
    data: { email: account.email, password: account.password },
  });
  expect(res.status()).toBe(200);
  const { token } = await res.json();
  return { authorization: `Bearer ${token}` };
}
export async function firstSlot(
  request: APIRequestContext,
  headers: Record<string, string>,
) {
  const res = await request.get(`${API}/api/slots`, { headers });
  expect(res.status()).toBe(200);
  const { items } = await res.json();
  expect(items).toHaveLength(12);
  return items[0] as { id: number; starts_at: string };
}
