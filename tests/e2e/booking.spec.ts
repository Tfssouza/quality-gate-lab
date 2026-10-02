import { type Page } from "@playwright/test";
import { test, expect, API, login, firstSlot } from "../fixtures/booking";
import { demoAccounts } from "../../database/seeds/accounts";

async function signIn(page: Page, role: "customer" | "operator" = "customer") {
  const account = demoAccounts[role === "customer" ? 0 : 2];
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(account.email, { exact: true })).toBeVisible();
}
test("customer books, refreshes and cancels a session", async ({
  page,
  request,
}) => {
  // Request fixture initializes the isolated dataset before the browser interaction.
  await signIn(page);
  const availability = page.getByRole("region", { name: "Available sessions" });
  await expect(availability.getByRole("button")).toHaveCount(12);
  await availability.getByRole("button").first().click();
  await expect(page.getByRole("status")).toHaveText("Booking confirmed.");
  const bookings = page.getByRole("region", { name: "My bookings" });
  await expect(bookings.getByText("confirmed", { exact: true })).toBeVisible();
  await page.reload();
  await signIn(page);
  await expect(bookings.getByText("confirmed", { exact: true })).toBeVisible();
  await bookings.getByRole("button", { name: /Cancel booking/ }).click();
  await expect(page.getByRole("status")).toHaveText("Booking cancelled.");
  await expect(bookings.getByText("cancelled", { exact: true })).toBeVisible();
  await expect(availability.getByRole("button")).toHaveCount(12);
});
test("invalid password produces an accessible error without signing in", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("customer@example.test");
  await page.getByLabel("Password", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid credentials");
  await expect(
    page.getByRole("heading", { name: "Sign in to book" }),
  ).toBeVisible();
});
test("operator sees and cancels a customer booking", async ({
  page,
  request,
}) => {
  const headers = await login(request);
  const slot = await firstSlot(request, headers);
  expect(
    (
      await request.post(`${API}/api/bookings`, {
        headers,
        data: { slotId: slot.id },
      })
    ).status(),
  ).toBe(201);
  await signIn(page, "operator");
  const bookings = page.getByRole("region", { name: "All bookings" });
  await expect(bookings.getByText("customer@example.test")).toBeVisible();
  await bookings.getByRole("button", { name: /Cancel booking/ }).click();
  await expect(bookings.getByText("cancelled", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Available sessions" }),
  ).toHaveCount(0);
});
test("stale availability reports a conflict and refreshes the list", async ({
  page,
  request,
}) => {
  const headers = await login(request, "other");
  const slot = await firstSlot(request, headers);
  await signIn(page);
  const buttons = page
    .getByRole("region", { name: "Available sessions" })
    .getByRole("button");
  await expect(buttons).toHaveCount(12);
  expect(
    (
      await request.post(`${API}/api/bookings`, {
        headers,
        data: { slotId: slot.id },
      })
    ).status(),
  ).toBe(201);
  await buttons.first().click();
  await expect(page.getByRole("alert")).toHaveText("Slot already booked");
  await expect(buttons).toHaveCount(11);
  await expect(page.getByText("No bookings yet.")).toBeVisible();
});
test("customer can sign out and sign back in", async ({ page, request }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to book" }),
  ).toBeVisible();
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "My bookings" }),
  ).toBeVisible();
});
test("mobile viewport keeps the booking flow usable without horizontal overflow", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page
    .getByRole("region", { name: "Available sessions" })
    .getByRole("button")
    .first()
    .click();
  await expect(page.getByRole("status")).toHaveText("Booking confirmed.");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
