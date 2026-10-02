import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";
import { demoAccounts } from "../../../database/seeds/accounts.js";

export type Row = Record<string, unknown>;
export interface Database {
  query<T extends Row = Row>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

export async function connectDatabase(): Promise<Database> {
  const url = process.env.DATABASE_URL;
  if (url) {
    if (
      process.env.TEST_MODE === "1" &&
      new URL(url).pathname !== "/quality_gate_test"
    ) {
      throw new Error(
        "Test resets require the dedicated quality_gate_test database.",
      );
    }
    const pool = new pg.Pool({ connectionString: url });
    return {
      query: (sql, params) => pool.query(sql, params),
      close: () => pool.end(),
    };
  }
  const db = new PGlite(
    process.env.TEST_MODE === "1"
      ? "memory://"
      : process.env.PGLITE_PATH || ".local/postgres",
  );
  await db.waitReady;
  return {
    query: (sql, params) => db.query(sql, params),
    close: () => db.close(),
  };
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export async function initializeDatabase(db: Database) {
  const schema = await readFile(
    new URL("../../../database/migrations/001_booking.sql", import.meta.url),
    "utf8",
  );
  for (const statement of schema.split(";").filter((s) => s.trim()))
    await db.query(statement);
  for (const account of demoAccounts) {
    await db.query(
      "INSERT INTO users(email, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING",
      [account.email, hashPassword(account.password), account.role],
    );
  }
  const count = await db.query("SELECT COUNT(*)::int AS total FROM slots");
  if (count.rows[0]?.total === 0) {
    for (let day = 1; day <= 3; day++) {
      for (const hour of [9, 11, 14, 16]) {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() + day);
        date.setUTCHours(hour, 0, 0, 0);
        await db.query(
          "INSERT INTO slots(service, starts_at) VALUES ($1, $2)",
          ["QA mentoring", date.toISOString()],
        );
      }
    }
  }
}

export async function resetTestData(db: Database) {
  await db.query("DELETE FROM bookings");
  await db.query("DELETE FROM slots");
  await initializeDatabase(db);
}
