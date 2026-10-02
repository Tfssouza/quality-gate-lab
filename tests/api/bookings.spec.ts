import { test, expect, API, login, firstSlot } from "../fixtures/booking";

test("health check confirms a database connection", async ({ request }) => {
  const res = await request.get(`${API}/health`);
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ status: "ok" });
});
test("protected endpoints reject missing and fabricated tokens", async ({
  request,
}) => {
  for (const authorization of ["", `Bearer ${"a".repeat(64)}`]) {
    expect(
      (
        await request.get(`${API}/api/bookings`, { headers: { authorization } })
      ).status(),
    ).toBe(401);
  }
});
test("invalid credentials and malformed login payloads are rejected", async ({
  request,
}) => {
  expect(
    (
      await request.post(`${API}/api/auth/login`, {
        data: { email: "customer@example.test", password: "wrong" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post(`${API}/api/auth/login`, {
        data: { email: 42, password: [] },
      })
    ).status(),
  ).toBe(400);
});
test("booking is persisted and removes the slot from availability", async ({
  request,
}) => {
  const headers = await login(request);
  const slot = await firstSlot(request, headers);
  const res = await request.post(`${API}/api/bookings`, {
    headers,
    data: { slotId: slot.id },
  });
  expect(res.status()).toBe(201);
  const booking = await res.json();
  expect(booking).toMatchObject({ slot_id: slot.id, status: "confirmed" });
  const list = await (
    await request.get(`${API}/api/bookings`, { headers })
  ).json();
  expect(list.items).toHaveLength(1);
  expect(list.items[0].id).toBe(booking.id);
  const slots = await (
    await request.get(`${API}/api/slots`, { headers })
  ).json();
  expect(slots.items).toHaveLength(11);
  expect(slots.items.some((s: { id: number }) => s.id === slot.id)).toBe(false);
});
test("concurrent customers cannot double-book a slot", async ({ request }) => {
  const customer = await login(request);
  const other = await login(request, "other");
  const slot = await firstSlot(request, customer);
  const responses = await Promise.all(
    [customer, other].map((headers) =>
      request.post(`${API}/api/bookings`, {
        headers,
        data: { slotId: slot.id },
      }),
    ),
  );
  expect(responses.map((r) => r.status()).sort()).toEqual([201, 409]);
  const operator = await login(request, "operator");
  const all = await (
    await request.get(`${API}/api/bookings`, { headers: operator })
  ).json();
  expect(all.items).toHaveLength(1);
});
test("customer cannot view or cancel another customer booking", async ({
  request,
}) => {
  const customer = await login(request);
  const other = await login(request, "other");
  const slot = await firstSlot(request, customer);
  const created = await (
    await request.post(`${API}/api/bookings`, {
      headers: customer,
      data: { slotId: slot.id },
    })
  ).json();
  const list = await (
    await request.get(`${API}/api/bookings`, { headers: other })
  ).json();
  expect(list.items).toEqual([]);
  expect(
    (
      await request.patch(`${API}/api/bookings/${created.id}/cancel`, {
        headers: other,
      })
    ).status(),
  ).toBe(403);
  const owner = await (
    await request.get(`${API}/api/bookings`, { headers: customer })
  ).json();
  expect(owner.items[0].status).toBe("confirmed");
});
test("operator can cancel a booking and the customer can book the released slot", async ({
  request,
}) => {
  const customer = await login(request);
  const operator = await login(request, "operator");
  const slot = await firstSlot(request, customer);
  const created = await (
    await request.post(`${API}/api/bookings`, {
      headers: customer,
      data: { slotId: slot.id },
    })
  ).json();
  const cancelled = await request.patch(
    `${API}/api/bookings/${created.id}/cancel`,
    { headers: operator },
  );
  expect(cancelled.status()).toBe(200);
  expect(await cancelled.json()).toMatchObject({ status: "cancelled" });
  expect(
    (
      await request.patch(`${API}/api/bookings/${created.id}/cancel`, {
        headers: customer,
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post(`${API}/api/bookings`, {
        headers: customer,
        data: { slotId: slot.id },
      })
    ).status(),
  ).toBe(201);
});
test("operator cannot create customer bookings", async ({ request }) => {
  const headers = await login(request, "operator");
  const slot = await firstSlot(request, headers);
  expect(
    (
      await request.post(`${API}/api/bookings`, {
        headers,
        data: { slotId: slot.id },
      })
    ).status(),
  ).toBe(403);
});
test("invalid and unknown slots are rejected without creating bookings", async ({
  request,
}) => {
  const headers = await login(request);
  for (const slotId of [null, -1, 0, "1", 1.5, {}, 2 ** 53]) {
    expect(
      (
        await request.post(`${API}/api/bookings`, { headers, data: { slotId } })
      ).status(),
    ).toBe(400);
  }
  expect(
    (
      await request.post(`${API}/api/bookings`, {
        headers,
        data: { slotId: 999999 },
      })
    ).status(),
  ).toBe(404);
  expect(
    (await request.get(`${API}/api/bookings`, { headers })).ok(),
  ).toBeTruthy();
  expect(
    (await (await request.get(`${API}/api/bookings`, { headers })).json())
      .items,
  ).toEqual([]);
});
test("logout revokes the session and test reset requires a key", async ({
  request,
}) => {
  const headers = await login(request);
  expect(
    (await request.post(`${API}/api/auth/logout`, { headers })).status(),
  ).toBe(204);
  expect((await request.get(`${API}/api/slots`, { headers })).status()).toBe(
    401,
  );
  expect((await request.post(`${API}/__test/reset`)).status()).toBe(403);
});
