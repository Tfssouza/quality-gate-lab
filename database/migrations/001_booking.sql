CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'operator'))
);
CREATE TABLE IF NOT EXISTS slots (
  id SERIAL PRIMARY KEY,
  service TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  slot_id INTEGER NOT NULL REFERENCES slots(id),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_booking_per_slot
ON bookings(slot_id) WHERE status = 'confirmed';
