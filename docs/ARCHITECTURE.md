# 🏛️ LeaveLedger Architecture & Deep Engineering Specification

LeaveLedger is a high-reliability, concurrency-safe distributed leave and balance ledger microservice built on NestJS and TypeScript. It provides bank-grade transaction consistency, atomic balance reservations, cryptographic audit chains, and resilient synchronization with external Human Capital Management (HCM) systems.

---

## 1. System Overview & Core Principles

```mermaid
flowchart TD
    Client([HTTP / API Gateway]) -->|JWT + Idempotency-Key| Guard[Rate Limiter & RBAC Guard]
    Guard --> Interceptor[Logging & Correlation Interceptor]
    Interceptor --> Controller[TimeOff Controller]
    
    subgraph Core Engine [LeaveLedger Core Balance Engine]
        Controller --> Idempotency[(Idempotency Store)]
        Controller --> Service[TimeOff Service]
        Service --> LockEngine[Row-Level Mutex & Transaction Manager]
        LockEngine --> DB[(SQLite WAL / PostgreSQL)]
        Service --> Hasher[Cryptographic Audit Chainer]
        Hasher --> AuditLog[(Audit Log Ledger)]
    end

    subgraph Async Resilience Layer [Resilient External HCM Sync]
        Service --> Outbox[(Transactional Outbox)]
        Outbox --> Dispatcher[Scheduled Sync Worker]
        Dispatcher --> Circuit[Circuit Breaker & Retry Engine]
        Circuit --> ExternalHCM([External Enterprise HCM API])
    end
```

### Core Tenets
1. **Never Overdraw:** Under no concurrency race condition can an employee balance drop below zero.
2. **Strict Idempotency:** Any duplicate request with identical `Idempotency-Key` returns the original cached result without re-executing business mutations.
3. **Decoupled HCM Outbox:** External HCM network latency and outages never hold open internal database transactions.
4. **Tamper-Evident History:** All balance movements are recorded in an append-only cryptographic ledger where each record hashes the previous record's signature.

---

## 2. Concurrency Control & ACID Transaction Design

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Client Thread A
    actor Bob as Client Thread B
    participant TM as Transaction Manager
    participant DB as Balance Ledger (WAL)
    
    Alice->>TM: Begin Transaction (Deduct 5 days)
    Bob->>TM: Begin Transaction (Deduct 5 days)
    TM->>DB: Acquire Atomic Lock on Employee Balance Row
    Note over DB: Thread A acquires row lock
    DB-->>Alice: Current Balance = 5 days (OK)
    Note over Bob: Thread B blocked on lock
    Alice->>DB: UPDATE Balance = 0, Append Ledger Entry
    Alice->>TM: Commit Transaction
    Note over DB: Lock released to Thread B
    DB-->>Bob: Current Balance = 0 days (Insufficient!)
    Bob-->>Bob: Evaluate Invariant (0 - 5 < 0) -> Reject
    Bob->>TM: Rollback Transaction
    Bob-->>Bob: Return 409 Conflict (Insufficient Balance)
```

### Isolation Guarantees
- **SQLite:** Configured with `PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`. Writers operate sequentially on the ledger table using exclusive write transactions, while readers execute non-blocking concurrently.
- **PostgreSQL Ready:** Configured for `SELECT ... FOR UPDATE` row-level pessimistic locking within `READ COMMITTED` or `REPEATABLE READ` transaction blocks.

---

## 3. The Two-Phase Balance Reservation Pattern

To prevent long-running external API calls from locking database rows, LeaveLedger implements a Two-Phase Reservation State Machine:

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> RESERVED: Atomic Balance Reservation
    RESERVED --> APPROVED: Manager / Auto Approval
    APPROVED --> SYNC_PENDING: Enqueue Outbox Event
    SYNC_PENDING --> SYNCED: HCM Ack (200 OK)
    SYNC_PENDING --> FAILED_RETRYING: HCM Flaky (503 / Timeout)
    FAILED_RETRYING --> SYNCED: Exponential Backoff Success
    FAILED_RETRYING --> DEAD_LETTER: Retry Exhausted
    RESERVED --> CANCELLED: Request Cancelled / Expired
    CANCELLED --> RELEASED: Atomic Balance Restored
    DEAD_LETTER --> MANUAL_REVIEW: Reconciliation Alarm
```

---

## 4. Resilient HCM Synchronization & Circuit Breaker

```mermaid
stateDiagram-v2
    [*] --> CLOSED: Initial Stable State
    CLOSED --> OPEN: Failure Threshold Exceeded (5 consecutive 5xx)
    OPEN --> HALF_OPEN: Cooldown Timer Elapsed (30s)
    HALF_OPEN --> CLOSED: Probe Request Succeeded
    HALF_OPEN --> OPEN: Probe Request Failed
```

### Jittered Exponential Backoff
When synchronizing with external HCM endpoints, retries follow decorrelated exponential backoff with full jitter to avoid the "thundering herd" problem:

$$t_{	ext{delay}} = \min\left(t_{	ext{max}}, 	ext{random}(0, t_{	ext{base}} 	imes 2^{	ext{attempt}})ight)$$

---

## 5. Cryptographic Audit Chain Specification

Every balance modification appends a tamper-evident audit record:

$$	ext{Hash}_n = 	ext{SHA256}\left(	ext{Hash}_{n-1} \,\|\, 	ext{Timestamp} \,\|\, 	ext{EmployeeID} \,\|\, 	ext{Action} \,\|\, 	ext{Delta} \,\|\, 	ext{PayloadHash}ight)$$

If an adversary alters a database row in historical records, the chain signature becomes invalid:

```text
[Record 0 (Genesis)] -> Hash: 0000...a1b2
       |
[Record 1 (Set 20)]   -> PrevHash: 0000...a1b2 | Hash: 4e9f...c3d1
       |
[Record 2 (Deduct 5)] -> PrevHash: 4e9f...c3d1 | Hash: 8b2a...e7f0  <-- Tamper detected if altered!
```

---

## 6. Threat Model & Security Posture (STRIDE)

| Threat Category | Potential Vector | Mitigation in LeaveLedger |
| :--- | :--- | :--- |
| **Spoofing** | Forged employee headers | JWT validation with RS256 / HS256 signatures in AuthGuard. |
| **Tampering** | In-flight payload alteration | Strict DTO validation with `class-validator` (whitelist & forbid non-whitelisted properties). |
| **Repudiation** | Denying leave balance modification | Append-only SHA-256 chained audit logs signed with correlation ID. |
| **Information Disclosure** | Stack trace leaking on 500 errors | Centralized `AllExceptionsFilter` strips internal errors and formats RFC 7807 problem details. |
| **Denial of Service** | Rapid deduction spamming | Sliding window rate limiting and request deduplication middleware. |
| **Elevation of Privilege** | Employee approving own leave | Role-Based Access Control (RBAC) hierarchy enforcing `MANAGER` and `HR_ADMIN` permissions. |
