![CI](https://github.com/Tfssouza/quality-gate-lab/actions/workflows/playwright.yml/badge.svg)

# 🚦 Quality Gate Lab

Production-oriented Quality Engineering demo.

This project simulates a real-world Quality Gate embedded into a CI/CD pipeline, validating API, UI and system behavior before any release is considered production-ready.

The focus is not only on automation — but on enforcing quality as a release control mechanism.

---

## 🎯 Engineering Objective

Modern QA is not about running tests manually.

It is about:

- Embedding automated validation inside delivery pipelines
- Blocking unsafe merges
- Detecting regressions early
- Validating system behavior across multiple browsers
- Treating quality as a measurable discipline

This lab demonstrates that mindset.

---

## 🏗 Architecture Overview

The project simulates a full validation layer for a digital product:

- Node.js API (Express + SQLite)
- Minimal Web UI
- API test layer
- End-to-End test layer
- Multi-browser execution (Chromium, Firefox, WebKit)
- CI/CD enforcement with matrix strategy
- Scheduled regression execution
- Artifact and service log collection per browser

---

## 🔁 CI/CD Quality Gate Strategy

The pipeline includes:

- Multi-browser matrix execution
- Parallel job orchestration
- API + E2E separation
- Background service orchestration
- Health-check validation before tests
- Automated merge blocking on failure
- Daily scheduled regression (02:00 UTC)
- HTML report artifacts per browser
- Log artifact collection for traceability

Every push and pull request must pass the Quality Gate before being considered safe.

---

## 🛠 Tech Stack

- Playwright (TypeScript)
- Node.js
- Express
- SQLite
- GitHub Actions
- CI Matrix Strategy

---

## ▶ Running Locally

Install dependencies:

```bash
npm ci
npx playwright install
