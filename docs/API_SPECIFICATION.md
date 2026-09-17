# 📋 LeaveLedger REST API Specification (OpenAPI 3.1 & RFC 7807)

This document specifies the REST interface for the LeaveLedger microservice. All responses adhere to standard HTTP semantics, with errors rendered in RFC 7807 `application/problem+json` format.

---

## Base URL
```text
http://localhost:3000/api/v1
```

---

## Global Headers

| Header | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `Authorization` | `string` | Yes | Bearer JWT token identifying the authenticated actor. |
| `Idempotency-Key` | `string (UUID)` | Yes (Mutations) | Unique client transaction token to prevent duplicate execution. |
| `X-Correlation-ID` | `string (UUID)` | Optional | Distributed tracing correlation ID (auto-generated if omitted). |

---

## Endpoints

### 1. Balance Operations

#### `GET /time-off/balance`
Fetch the current settled and reserved leave balance for an employee.

- **Query Parameters:**
  - `employeeId` (string, required): Employee identifier.
  - `locationId` (string, required): Office or jurisdiction identifier.
  - `leaveType` (string, required): `VACATION`, `SICK`, `PARENTAL`, etc.

- **Response `200 OK`:**
  ```json
  {
    "employeeId": "EMP-0419",
    "locationId": "LOC-US-NYC",
    "leaveType": "VACATION",
    "balance": 18.5,
    "reserved": 3.0,
    "available": 15.5,
    "lastUpdated": "2026-09-17T12:00:00.000Z"
  }
  ```

#### `POST /time-off/balance/set`
Admin endpoint to initialize or adjust balance baseline.

- **Request Body:**
  ```json
  {
    "employeeId": "EMP-0419",
    "locationId": "LOC-US-NYC",
    "leaveType": "VACATION",
    "balance": 25.0,
    "reason": "Annual accrual allocation"
  }
  ```

---

### 2. Time-Off Request Operations

#### `POST /time-off/requests`
Submit a new leave request. Atomically reserves balance.

- **Request Body:**
  ```json
  {
    "employeeId": "EMP-0419",
    "locationId": "LOC-US-NYC",
    "leaveType": "VACATION",
    "startDate": "2026-10-01",
    "endDate": "2026-10-05",
    "days": 5.0,
    "comments": "Family vacation"
  }
  ```

- **Response `201 Created`:**
  ```json
  {
    "id": "req-98f2c310-8b4e-4f3b",
    "employeeId": "EMP-0419",
    "leaveType": "VACATION",
    "days": 5.0,
    "status": "APPROVED",
    "hcmSyncStatus": "PENDING",
    "createdAt": "2026-09-17T15:30:00.000Z"
  }
  ```

- **Response `409 Conflict` (Insufficient Balance):**
  ```json
  {
    "type": "https://errors.leaveledger.io/insufficient-balance",
    "title": "Insufficient Leave Balance",
    "status": 409,
    "detail": "Requested 5.0 days but available balance is only 2.0 days.",
    "instance": "/time-off/requests",
    "code": "INSUFFICIENT_BALANCE"
  }
  ```

---

### 3. Observability & Health Probes

#### `GET /health`
Liveness, readiness, and subsystem telemetry probe.

- **Response `200 OK`:**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-09-17T15:35:00.000Z",
    "uptimeSeconds": 14520,
    "checks": {
      "database": {
        "status": "healthy",
        "responseTimeMs": 1.2
      },
      "circuitBreaker": {
        "status": "healthy",
        "state": "CLOSED",
        "failureCount": 0
      },
      "outbox": {
        "status": "healthy",
        "pendingCount": 0
      }
    }
  }
  ```
