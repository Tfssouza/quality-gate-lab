# Quality Gate Lab — Booking Studio

A small booking product built to demonstrate QA engineering through executable evidence:
API authorization, concurrent reservations, SQL integrity and cross-browser user journeys.

The application lets customers book QA mentoring sessions and lets an operator inspect
and cancel reservations. This is a local portfolio laboratory with fictitious accounts,
not a production booking service.

![Booking Studio: customer availability and a confirmed reservation](docs/images/booking-studio.jpg)

## Technology

- TypeScript, React and Vite for the web interface
- Node.js 24.16.0 and Express for the API
- PostgreSQL 17.9 in Docker/CI; embedded PostgreSQL (PGlite) for local development
- Playwright 1.63.0 for API and browser tests
- Docker Compose and GitHub Actions

Versions are pinned in package.json, package-lock.json, .nvmrc and container tags.
Container tags identify versions but are not immutable image digests.

## Prerequisites

- Node.js 24.16.0 with npm (see .nvmrc)
- Browser installation for E2E tests
- Docker Engine/Desktop with Compose v2 only for the container route

The basic local route needs neither Docker nor a separately installed PostgreSQL server.
All npm packages are installed locally. On Windows, use npm.cmd/npx.cmd if PowerShell
execution policy prevents launching their .ps1 wrappers.

## Install and start

```sh
git clone https://github.com/Tfssouza/quality-gate-lab.git
cd quality-gate-lab
npm ci
npm run dev
```

Open http://127.0.0.1:3000. API readiness is available at http://127.0.0.1:3001/health.
Stop development with Ctrl+C. The local SQL data lives in .local/postgres, ignored by Git.
Accounts and twelve sessions across the next three days are seeded automatically.

| Role            | Email                 | Password            |
| --------------- | --------------------- | ------------------- |
| Customer        | customer@example.test | Customer-Demo-2026! |
| Second customer | other@example.test    | Customer-Demo-2026! |
| Operator        | operator@example.test | Operator-Demo-2026! |

These credentials are intentionally public demo data. Use no real personal data.
The customer can create and cancel their own bookings. The operator can view all
bookings and cancel them, but cannot create customer bookings.

The browser token is held in memory: refresh requires signing in again. Reservations
persist. Server restarts revoke all sessions. Times are explicitly displayed in UTC.

## Run tests

```sh
npx playwright install chromium firefox webkit
npm run test:api
npm run test:e2e
npm test
npm run test:report
```

- API: ten risk-based scenarios, independent of a browser binary.
- E2E: six business scenarios in each of Chromium, Firefox and WebKit.
- Responsive coverage is browser viewport testing, not native mobile testing.
- Ports 3100/3101 are reserved for isolated tests; tests refuse to reuse an existing server.
- Test data is reset before each test. A single worker prevents dataset interference.
- Failures retain traces and screenshots; HTML and JUnit reports are generated.
- There are no retries or hardcoded UI sleeps hiding failures.

Local verification on Windows passed API, Chromium and WebKit. Firefox remains
unvalidated locally because Windows Application Control blocks its browser dependency.
The default suite still includes Firefox; the Linux CI job must validate it separately.
See [verification evidence](docs/verification.md) for the current publication status.

Without TEST_DATABASE_URL, tests use an isolated in-memory PostgreSQL engine.
To test a PostgreSQL service, supply a dedicated database named quality_gate_test:

```sh
TEST_DATABASE_URL=postgresql://booking:booking-demo@127.0.0.1:5432/quality_gate_test npm test
```

PowerShell equivalent:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://booking:booking-demo@127.0.0.1:5432/quality_gate_test'
npm.cmd test
Remove-Item Env:TEST_DATABASE_URL
```

Do not use a production or personal database. Test mode rejects any other database name.
The reset endpoint only exists in test mode and requires a fixture key.

## Build and verify production assets

```sh
npm run build
npm run test:production
```

The production check starts its own server on port 3201 with a new local database,
checks compiled assets, API login and seed data, creates a reservation, restarts the
server, and verifies persistence and session revocation. It closes its own processes.
Generated verification databases remain under .local and are ignored by Git.

To manually run the compiled application, first build, then set NODE_ENV=production:

```powershell
$env:NODE_ENV = 'production'
npm.cmd start
```

Open http://127.0.0.1:3001. For bash: NODE_ENV=production npm start.
Clear NODE_ENV afterwards before returning to ordinary development.

## Docker / PostgreSQL

```sh
docker compose up --build --wait
node scripts/smoke.mjs http://127.0.0.1:3000
docker compose down
```

Compose runs PostgreSQL and the compiled web/API application. Only the app is exposed,
on 127.0.0.1:3000; the database is internal to the Compose network. The named database
volume persists when containers stop. Ordinary Docker execution never enables test reset.

To use an independently managed PostgreSQL database, set DATABASE_URL in the shell.
.env.example is a connection reference; npm commands do not automatically load .env files.

## API

| Method | Endpoint                 | Rule                                                |
| ------ | ------------------------ | --------------------------------------------------- |
| GET    | /health                  | Checks the database connection                      |
| POST   | /api/auth/login          | Validates credentials and issues a one-hour session |
| POST   | /api/auth/logout         | Revokes the current session                         |
| GET    | /api/slots               | Authenticated; future available slots only          |
| GET    | /api/bookings            | Customers see their own records; operator sees all  |
| POST   | /api/bookings            | Customer only; JSON body: {"slotId": 123}           |
| PATCH  | /api/bookings/:id/cancel | Booking owner or operator only                      |

Missing authentication returns 401; denied role/ownership returns 403; invalid input
returns 400; unknown resources return 404; reservation conflicts return 409.
A SQL partial unique index enforces one confirmed booking per slot, including concurrent
requests. Cancellation preserves history and releases the slot for a new booking.

## Project structure

```text
apps/api/src/             API, sessions and database adapter
apps/web/src/             React interface and styles
database/migrations/      Idempotent SQL schema
database/seeds/           Fictitious accounts
tests/api/                Authorization, boundaries, concurrency and persistence
tests/e2e/                Customer and operator browser journeys
tests/fixtures/           Controlled setup and API helpers
scripts/                  Production smoke and restart verification
docs/                     Architecture, test strategy and verification status
.github/workflows/        API, browser, Docker and aggregate quality gates
compose.yaml              PostgreSQL + production application
```

## CI quality gate

The workflow runs build/typecheck and API tests against PostgreSQL, browser tests in
separate Chromium/Firefox/WebKit jobs, and a Docker production smoke check. Each job
uploads its own evidence so reports do not overwrite each other. A dependency audit
rejects known high/critical advisories. No deployment or scheduled execution is claimed.

The aggregate Quality gate must pass. Blocking a merge additionally requires the owner
to configure a required status check in a branch rule; that setting is not supplied by YAML.
See docs/verification.md for what has actually been executed, including environment limits.

## Troubleshooting

- **Port already in use:** stop your own process using ports 3000/3001, 3100/3101 or 3201.
  Tests deliberately refuse to attach to arbitrary running servers.
- **No future sessions in a persistent local dataset:** the initial pool covers three days.
  Select a new PGLITE_PATH directory for a fresh demo dataset; existing bookings stay intact.
- **Browser launch/DLL error:** use Playwright's supported host prerequisites and check
  Windows application-control restrictions. Do not disable security controls or fetch DLLs
  from unofficial sources. API-only tests can run independently.
- **Docker command unavailable:** use the embedded local route. Docker verification remains
  a separate CI job; embedded execution does not prove container behavior.
- **PostgreSQL connection fails:** verify the URL, database availability and permissions.
  /health only reports ready once a database query succeeds.

## Scope and limits

This project demonstrates QA engineering and complementary development, not production
identity management. Demo accounts, in-memory sessions, initial seeding and a single
migration are deliberate limits. No payments, native mobile/Appium suite, performance
certification or complete WCAG compliance is claimed.

See [architecture](docs/architecture.md) and [test strategy](docs/test-strategy.md).
