# Test strategy

## Business risks and coverage

| Risk                                                        | Evidence                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| Two customers reserve the same session                      | Concurrent API requests; exactly one succeeds; SQL partial unique index  |
| Customer reads or cancels another customer's reservation    | API role and ownership assertions; owner record remains unchanged        |
| Cancellation never releases availability                    | API cancel/rebook and browser create/cancel flows                        |
| Stale browser availability loses data or lies about success | Second customer books via API; browser receives conflict and refreshes   |
| Operator receives customer booking powers                   | API denies create; browser has no booking section                        |
| Malformed input creates invalid records                     | Boundary and type validation; empty booking list after rejected requests |
| Session survives logout                                     | Previously valid token rejected after logout                             |
| Build ships a broken interface                              | Typecheck, production build and Docker smoke verify assets and login     |
| Tests depend on previous test order                         | Every test starts with isolated data and revoked sessions                |

API tests run once; six business UI scenarios run in each of Chromium, Firefox and WebKit.
The responsive scenario is browser viewport testing, not native mobile testing or device certification.

## Isolation

Tests use ports 3100/3101 and refuse to reuse running servers. One worker is intentional:
the small lab resets a single dedicated dataset per test. Independent CI jobs each have
their own PostgreSQL service. No sleeps or retries hide failures; Playwright locators and
HTTP readiness checks synchronize execution.

The reset endpoint exists only with TEST_MODE=1, requires a fixture key, and rejects
external database names other than quality_gate_test. Ordinary app data cannot be reset
by this test configuration. Never point the lab at a real business database.

## Approval policy

Typecheck, build, all API and browser tests, Docker smoke and the high/critical dependency
audit must pass. GitHub's Quality gate job aggregates the results. Enforcing it before
merge requires an owner-configured branch rule; a workflow alone does not block merging.

HTML, JUnit, screenshots and traces on failure are generated in one run per CI job, so
API and browser reports do not overwrite one another. Docker logs are a separate artifact.

## Limits

No payment integration, native mobile tests, performance testing, full WCAG evaluation,
or production authentication is claimed. This lab is not a commercial booking service.
