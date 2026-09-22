# Contributing to LeaveLedger

Thank you for your interest in contributing to LeaveLedger! This guide covers everything you need to get up and running locally, understand the project architecture, and submit high-quality pull requests.

---

## Table of Contents

- [Local Development Setup](#local-development-setup)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Commit Message Convention](#commit-message-convention)

---

## Local Development Setup

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | `>= 18.x` |
| npm | `>= 9.x` |
| PostgreSQL | `>= 14` |
| Docker (optional) | `>= 24.x` |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Asadshah7950/LeaveLedger.git
cd LeaveLedger

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.example .env

# 4. Configure your local environment
# Edit .env with your PostgreSQL credentials
```

### Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/leaveled` |
| `REDIS_URL` | Redis connection string (for distributed locking) | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | `your-super-secret-key` |
| `PORT` | HTTP server port | `3000` |

### Running with Docker

```bash
# Start all services (PostgreSQL + Redis + App)
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f app
```

---

## Running Tests

```bash
# Run full unit test suite (195 tests)
npm test

# Run a specific test file
npx jest test/unit/dead-letter-queue.util.spec.js

# Run concurrency stress benchmark (verifies 0 race conditions)
npm run test:benchmark

# Run with coverage report
npx jest --coverage
```

### Test Architecture

Tests are organized by layer under `test/`:

```
test/
├── unit/                     # Pure unit tests (no I/O)
│   ├── dead-letter-queue.util.spec.js    # DLQ fault isolation
│   ├── circuit-breaker.util.spec.js      # Circuit breaker state machine
│   ├── idempotency.util.spec.js          # Request deduplication
│   ├── lock.util.spec.js                 # Distributed lock manager
│   ├── rate-limiter.util.spec.js         # Rate limiting engine
│   └── ...                              # 28 test suites total
└── e2e/                      # End-to-end API tests (coming soon)
```

---

## Project Structure

```
src/
├── common/
│   ├── filters/              # Exception filters (RFC 7807 Problem Details)
│   ├── interceptors/         # Logging, metrics, correlation ID
│   └── utils/                # Core utility library
│       ├── dead-letter-queue.util.js     # DLQ & poison-pill isolation
│       ├── circuit-breaker.util.js       # 3-state circuit breaker
│       ├── idempotency.util.js           # Request deduplication engine
│       ├── lock.util.js                  # TTL-based distributed lock
│       ├── rate-limiter.util.js          # Sliding window rate limiter
│       ├── token-bucket-limiter.util.js  # Fractional token bucket
│       ├── retry.util.js                 # Backoff retry orchestrator
│       ├── traceparent.util.js           # W3C distributed tracing
│       ├── audit-logger.util.js          # Tamper-evident audit ledger
│       ├── audit-hash.util.js            # SHA-256 hash chain verifier
│       ├── event-bus.util.js             # In-process pub/sub
│       └── rbac.util.js                  # Role-based access control
├── leave/
│   ├── leave.controller.js   # REST API endpoints
│   ├── leave.service.js      # Business logic & 2-phase reservation
│   └── leave.repository.js   # Data access layer (TypeORM)
docs/
├── ARCHITECTURE.md           # Full system design with sequence diagrams
├── API_SPECIFICATION.md      # OpenAPI / RFC 7807 specification
└── assets/
    └── architecture_diagram.png   # Visual 4-layer pipeline diagram
benchmarks/
└── concurrency_benchmark.js  # Parallel stress test harness
```

---

## Architecture Overview

LeaveLedger implements a **two-phase balance reservation pattern** to guarantee ACID-compliant leave balance management under concurrent load:

```
Phase 1 – RESERVE:    Idempotency Check → Lock Acquire → Balance Deduct → PENDING state
Phase 2 – COMMIT:     Validate confirmation → Mark CONFIRMED → Release lock → Outbox event
Phase 2 – RELEASE:    Validate cancel → Restore balance → Mark RELEASED → Release lock
```

Key resilience components:

- **Dead-Letter Queue (DLQ):** Quarantines failed outbox dispatches with poison-pill detection
- **Circuit Breaker:** Isolates downstream HCM API failures (CLOSED → OPEN → HALF-OPEN)
- **Idempotency Manager:** Prevents duplicate reservations from client retries
- **Audit Hash Chain:** SHA-256 tamper-evident log of all balance mutations

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for full sequence diagrams and formal ACID proofs.

---

## Pull Request Guidelines

1. **One concern per PR** — keep diffs focused and reviewable.
2. **Tests are required** — every new utility or service must have corresponding unit tests.
3. **No test coverage reduction** — the current suite runs 195 tests with 0 failures. PRs that reduce coverage will be asked to add tests first.
4. **Lint clean** — run `npm run lint` before submitting. Zero ESLint warnings expected.
5. **Descriptive PR title** — follow the commit convention below.

---

## Commit Message Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(scope): short description

Types:
  feat      New feature or capability
  fix       Bug fix
  refactor  Code restructure without behavior change
  test      New or updated tests
  docs      Documentation only changes
  chore     Tooling, CI, dependencies
  perf      Performance improvement

Examples:
  feat(resilience): add dead-letter queue with exponential backoff redrive
  fix(lock): prevent double-release on expired TTL token
  test(idempotency): add concurrent collision edge case
  docs(architecture): update 2PC sequence diagram for release path
```
