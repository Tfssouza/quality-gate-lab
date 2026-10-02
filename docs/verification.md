# Verification record

Date: 2026-10-02. Local working tree on codex/booking-quality-gate; not a released version.
Host: Windows, Node.js 24.16.0, npm 11.13.0, Playwright 1.63.0.

| Check                                  | Observed result                                         |
| -------------------------------------- | ------------------------------------------------------- |
| npm ci from the dependency lockfile    | Passed                                                  |
| npm audit                              | Zero known advisories at verification time              |
| npm run build                          | Passed: TypeScript and compiled React assets            |
| API scenarios against isolated PGlite  | 10 passed                                               |
| Chromium E2E scenarios                 | 6 passed                                                |
| WebKit E2E scenarios                   | 6 passed                                                |
| Firefox E2E scenarios                  | Blocked before execution by Windows Application Control |
| Production assets and API smoke        | Passed                                                  |
| Persistent SQL data across API restart | Passed; booking preserved, old token rejected           |
| Docker / PostgreSQL service            | Not run locally: Docker is not installed                |
| Updated GitHub Actions workflow        | Configured; not yet published or executed remotely      |

The full 28-test run returned a failure: 22 passed and six Firefox scenarios could not
launch their browser. The diagnostic mentioned gkcodecs.dll. The DLL is present in the
official download; PrintDeps.exe confirmed an Application Control policy blocked loading
it. Security policy was not changed, browser validation was not bypassed, and no browser
tests were silently skipped.

After a clean npm ci, the explicit API/Chromium/WebKit selection passed all 22 scenarios.
The final publication review repeated this in a fresh source-only directory with no
node_modules, build output or database copied in: npm ci, formatting check, dependency
audit, build, all 22 available scenarios and production restart verification passed.
A fresh Firefox sign-out scenario still failed before browser execution with the same
host dependency error. Docker was checked again and remains unavailable locally.
The publication candidate contains only source, lockfile, configuration, documentation
and the fictitious demo screenshot. No real secrets were found in the candidate files;
.env files, local databases, reports, logs and dependency/build directories are ignored.
The default npm test still includes Firefox. Successful subsets are not a claim that the
full local suite passed.

Local PGlite execution validates the SQL/application path but not the pg network adapter,
PostgreSQL service configuration or container startup. The workflow includes explicit
PostgreSQL and Docker jobs for those checks. Both Docker image version tags were confirmed
to exist in the official registry; that check is not equivalent to building/running them.

Before presenting this version as a completed portfolio project, publish the branch and
obtain a successful GitHub quality gate, including Linux Firefox and Docker. Then record
the tested commit and run URL here. No green badge is attached to this unverified revision.
