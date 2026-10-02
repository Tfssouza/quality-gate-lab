# Architecture

React UI -> same-origin /api requests -> Express API -> PostgreSQL tables.

Vite proxies /api during development. The production Express server serves the built
React app and API from one origin; no CORS policy is needed.

The SQL schema defines users, slots and bookings. Cancellation preserves booking history.
A partial unique index permits only one confirmed booking per slot. Conflicting concurrent
inserts return HTTP 409; uniqueness is enforced in the database, not just in the browser.

Passwords use salted scrypt hashes. Opaque random sessions expire after one hour and are
revoked at logout. Sessions are in process memory; server restarts require signing in again.
The browser keeps its token in memory, never in localStorage. Customer queries are scoped
to their user id; operators can inspect and cancel reservations but cannot create them.

The same schema and seed code run against a pg connection in Docker/CI and PGlite for a
low-friction local run. PGlite is an embedded PostgreSQL engine; it does not validate the
network driver, Docker orchestration or deployment. CI explicitly uses a PostgreSQL service
and separately builds and checks the production Docker image.

Migration 001 is idempotent. Demo accounts are inserted only when absent. Twelve future
slots are seeded when the slots table is empty. Resetting test data deletes only the
dedicated test bookings and slots and reseeds future slots; ids are not assumed by tests.

Production hardening would additionally require real identity management, secure cookie
sessions, abuse limits, migration versioning, monitoring and deployment-specific policies.
