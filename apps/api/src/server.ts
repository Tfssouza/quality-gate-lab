import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  connectDatabase,
  initializeDatabase,
  resetTestData,
} from "./database.js";

const db = await connectDatabase();
await initializeDatabase(db);
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
type Session = {
  id: number;
  email: string;
  role: "customer" | "operator";
  expires: number;
};
const sessions = new Map<string, Session>();
type AuthRequest = Request & { user?: Session };

function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.match(
    /^Bearer ([a-f0-9]{64})$/,
  )?.[1];
  const session = token ? sessions.get(token) : undefined;
  if (!session || session.expires < Date.now()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  req.user = session;
  next();
}
const fail = (res: Response, status: number, error: string) =>
  res.status(status).json({ error });

app.get("/health", async (_req, res) => {
  await db.query("SELECT 1");
  res.json({
    status: "ok",
    database: process.env.DATABASE_URL ? "postgresql" : "pglite",
  });
});
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email ||
    !password ||
    password.length > 128
  ) {
    fail(res, 400, "Email and password are required");
    return;
  }
  const result = await db.query(
    "SELECT id, email, password_hash, role FROM users WHERE email = $1",
    [email.toLowerCase().trim()],
  );
  const user = result.rows[0];
  const [salt, expected] = String(user?.password_hash || "").split(":");
  const valid =
    salt &&
    expected &&
    timingSafeEqual(
      scryptSync(password, salt, 64),
      Buffer.from(expected, "hex"),
    );
  if (!user || !valid) {
    fail(res, 401, "Invalid credentials");
    return;
  }
  const token = randomBytes(32).toString("hex");
  const session: Session = {
    id: Number(user.id),
    email: String(user.email),
    role: user.role as Session["role"],
    expires: Date.now() + 3_600_000,
  };
  sessions.set(token, session);
  res.json({ token, user: { email: session.email, role: session.role } });
});
app.post("/api/auth/logout", auth, (req, res) => {
  sessions.delete(req.headers.authorization!.slice(7));
  res.status(204).end();
});
app.get("/api/slots", auth, async (_req, res) => {
  const result =
    await db.query(`SELECT s.id, s.service, s.starts_at FROM slots s
    WHERE s.starts_at > CURRENT_TIMESTAMP AND NOT EXISTS (
      SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed') ORDER BY s.starts_at`);
  res.json({ items: result.rows });
});
app.get("/api/bookings", auth, async (req: AuthRequest, res) => {
  const user = req.user!;
  const result = await db.query(
    `SELECT b.id, b.slot_id, b.status, s.service, s.starts_at, u.email
    FROM bookings b JOIN slots s ON s.id=b.slot_id JOIN users u ON u.id=b.user_id
    ${user.role === "customer" ? "WHERE b.user_id=$1" : ""} ORDER BY b.id`,
    user.role === "customer" ? [user.id] : [],
  );
  res.json({ items: result.rows });
});
app.post("/api/bookings", auth, async (req: AuthRequest, res) => {
  if (req.user!.role !== "customer") {
    fail(res, 403, "Only customers can book");
    return;
  }
  const slotId = req.body?.slotId;
  if (!Number.isSafeInteger(slotId) || slotId < 1) {
    fail(res, 400, "A valid slotId is required");
    return;
  }
  const slot = await db.query(
    "SELECT id FROM slots WHERE id=$1 AND starts_at > CURRENT_TIMESTAMP",
    [slotId],
  );
  if (!slot.rows.length) {
    fail(res, 404, "Slot not found or expired");
    return;
  }
  try {
    const result = await db.query(
      "INSERT INTO bookings(user_id, slot_id) VALUES ($1, $2) RETURNING id, slot_id, status",
      [req.user!.id, slotId],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      fail(res, 409, "Slot already booked");
      return;
    }
    throw error;
  }
});
app.patch("/api/bookings/:id/cancel", auth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    fail(res, 400, "A valid booking id is required");
    return;
  }
  const result = await db.query(
    "SELECT id, user_id, status FROM bookings WHERE id=$1",
    [id],
  );
  const booking = result.rows[0];
  if (!booking) {
    fail(res, 404, "Booking not found");
    return;
  }
  if (
    req.user!.role !== "operator" &&
    Number(booking.user_id) !== req.user!.id
  ) {
    fail(res, 403, "You cannot cancel this booking");
    return;
  }
  const updated = await db.query(
    "UPDATE bookings SET status='cancelled' WHERE id=$1 AND status='confirmed' RETURNING id, slot_id, status",
    [id],
  );
  if (!updated.rows.length) {
    fail(res, 409, "Booking already cancelled");
    return;
  }
  res.json(updated.rows[0]);
});

// Absent from ordinary local and Docker deployments.
if (process.env.TEST_MODE === "1") {
  if (!process.env.TEST_RESET_KEY)
    throw new Error("TEST_RESET_KEY is required in test mode");
  app.post("/__test/reset", async (req, res) => {
    if (req.header("x-test-reset-key") !== process.env.TEST_RESET_KEY) {
      fail(res, 403, "Forbidden");
      return;
    }
    await resetTestData(db);
    sessions.clear();
    res.status(204).end();
  });
}
app.use("/api", (_req, res) => {
  fail(res, 404, "Endpoint not found");
});
if (process.env.NODE_ENV === "production") {
  const web = fileURLToPath(new URL("../../../dist/web/", import.meta.url));
  app.use(express.static(web));
  app.get(/^(?!\/api|\/health|\/__test).*/, (_req, res) =>
    res.sendFile(`${web}index.html`),
  );
}
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof SyntaxError) {
    fail(res, 400, "Invalid JSON");
    return;
  }
  if ((err as { type?: string })?.type === "entity.too.large") {
    fail(res, 413, "Payload too large");
    return;
  }
  console.error(err instanceof Error ? err.message : "Unexpected error");
  fail(res, 500, "Internal server error");
});
const server = app.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "127.0.0.1",
  () => console.log("Booking API ready"),
);
function shutdown() {
  server.close(() => {
    void db.close().then(() => process.exit(0));
  });
}
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, shutdown);
}
// Child-process verification can request graceful shutdown on Windows through IPC.
process.on("message", (message) => {
  if (message === "shutdown") shutdown();
});
