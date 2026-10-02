import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type User = { email: string; role: "customer" | "operator" };
type Slot = { id: number; service: string; starts_at: string };
type Booking = Slot & { slot_id: number; email: string; status: string };
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function api(
    path: string,
    options: RequestInit = {},
    accessToken = token,
  ) {
    const res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    });
    const data = res.status === 204 ? null : await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }
  async function refresh(accessToken = token, signal?: AbortSignal) {
    const [availability, reservations] = await Promise.all([
      api("/slots", { signal }, accessToken),
      api("/bookings", { signal }, accessToken),
    ]);
    if (signal?.aborted) return;
    setSlots(availability.items);
    setBookings(reservations.items);
  }
  useEffect(() => {
    const controller = new AbortController();
    if (token)
      void refresh(token, controller.signal).catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [token]);
  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setUser(data.user);
      setToken(data.token);
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function act(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      await refresh();
      setMessage(
        method === "POST" ? "Booking confirmed." : "Booking cancelled.",
      );
    } catch (e) {
      setError((e as Error).message);
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api("/auth/logout", { method: "POST" });
      setToken("");
      setUser(null);
      setSlots([]);
      setBookings([]);
      setMessage("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header>
        <a href="/" className="brand">
          Booking Studio<span>Quality Gate Lab</span>
        </a>
        <span className="tag">A product testing laboratory</span>
      </header>
      <main>
        <section className="intro">
          <p className="eyebrow">A little time. A clearer next step.</p>
          <h1>
            Make room for
            <br />
            your next session.
          </h1>
          <p>Book a QA mentoring session. Manage your time with confidence.</p>
        </section>
        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}
        <p role="status" aria-live="polite" className="status">
          {message}
        </p>
        {!user ? (
          <section className="card login" aria-labelledby="login-title">
            <h2 id="login-title">Sign in to book</h2>
            <form onSubmit={login}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
            <details>
              <summary>Demo accounts</summary>
              <p>
                Customer: customer@example.test
                <br />
                Password: Customer-Demo-2026!
              </p>
              <p>
                Operator: operator@example.test
                <br />
                Password: Operator-Demo-2026!
              </p>
              <p>Fictitious accounts for this laboratory only.</p>
            </details>
          </section>
        ) : (
          <>
            <div className="account">
              <p>
                Signed in as <strong>{user.email}</strong>{" "}
                <span className="tag">{user.role}</span>
              </p>
              <button className="secondary" disabled={busy} onClick={logout}>
                Sign out
              </button>
            </div>
            <div className="workspace">
              {user.role === "customer" && (
                <section className="card" aria-labelledby="availability-title">
                  <h2 id="availability-title">Available sessions</h2>
                  <p className="muted">All times are shown in UTC.</p>
                  {slots.length === 0 && <p>No sessions are available.</p>}
                  <ul className="sessions">
                    {slots.map((slot) => (
                      <li key={slot.id}>
                        <div>
                          <strong>{slot.service}</strong>
                          <p>{formatDate(slot.starts_at)} UTC</p>
                        </div>
                        <button
                          disabled={busy}
                          aria-label={`Book ${formatDate(slot.starts_at)} UTC`}
                          onClick={() =>
                            act("/bookings", "POST", { slotId: slot.id })
                          }
                        >
                          Book session
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="card" aria-labelledby="bookings-title">
                <h2 id="bookings-title">
                  {user.role === "operator" ? "All bookings" : "My bookings"}
                </h2>
                {bookings.length === 0 ? (
                  <p>No bookings yet.</p>
                ) : (
                  <ul className="sessions">
                    {bookings.map((booking) => (
                      <li key={booking.id}>
                        <div>
                          <strong>{booking.service}</strong>
                          <p>{formatDate(booking.starts_at)} UTC</p>
                          {user.role === "operator" && <p>{booking.email}</p>}
                          <span className={`badge ${booking.status}`}>
                            {booking.status}
                          </span>
                        </div>
                        {booking.status === "confirmed" && (
                          <button
                            className="secondary"
                            disabled={busy}
                            aria-label={`Cancel booking ${booking.id}`}
                            onClick={() =>
                              act(`/bookings/${booking.id}/cancel`, "PATCH")
                            }
                          >
                            Cancel booking
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </main>
      <footer>
        Built to demonstrate reliable product validation. Fictitious data only.
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
