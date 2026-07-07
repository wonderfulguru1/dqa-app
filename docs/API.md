# ECEWS DQA Companion — API Reference

REST-style JSON API served by the Next.js app under `/api`.

**Base URL (local dev):** `http://localhost:3000`

**Content type:** `application/json` unless noted otherwise.

---

## Authentication

All endpoints except `POST /api/auth/login` require a valid session.

### How sessions work

1. Call `POST /api/auth/login` with email and password.
2. The server sets an HTTP-only cookie named `dqa_session` (JWT, 8-hour expiry).
3. Send that cookie on every subsequent request (`credentials: 'include'` in `fetch`, or `-b cookies.txt` with curl).

| Role   | Access |
|--------|--------|
| `field` | Own state’s data; cannot delete bulk data or manage users/preloads |
| `hq`    | All states; preload upload, user CRUD, bulk deletes |

### Field state scoping

On `GET` for `/api/tx`, `/api/agg`, and `/api/issues`, if the user is a field user with a `state` assigned and no `state` query param is passed, results are automatically filtered to that state.

---

## Error responses

Errors are JSON objects with an `error` string:

```json
{ "error": "Unauthorized" }
```

| Status | Meaning |
|--------|---------|
| `400`  | Missing or invalid request data |
| `401`  | Not logged in |
| `403`  | Logged in but insufficient role (usually HQ-only) |
| `404`  | Resource not found |
| `409`  | Conflict (e.g. duplicate email) |
| `500`  | Server error |

---

## Auth

### `POST /api/auth/login`

Log in and receive a session cookie.

**Body:**

```json
{
  "email": "admin@ecews.org",
  "password": "your-password"
}
```

**Success (`200`):**

```json
{
  "role": "hq",
  "name": "Admin User"
}
```

**Errors:** `400` (missing fields), `401` (invalid credentials)

---

### `POST /api/auth/logout`

Clear the session cookie.

**Success (`200`):**

```json
{ "ok": true }
```

---

### `GET /api/auth/me`

Return the current user from the session.

**Success (`200`):**

```json
{
  "id": 1,
  "name": "Admin User",
  "email": "admin@ecews.org",
  "role": "hq",
  "state": null
}
```

**Errors:** `401` if not authenticated

---

## Field bootstrap

Used by the field app to load preloads and saved validations in one or few calls.

### `GET /api/field/bootstrap`

**Query parameters:**

| Param  | Values | Default     | Description |
|--------|--------|-------------|-------------|
| `part` | `preloads`, `saved`, `all` | `preloads` | Which data bundle to return |

**`part=preloads` response** includes:

| Field | Type | Description |
|-------|------|-------------|
| `activeTxPreload` | object \| null | Metadata for the active TX preload |
| `activeAggPreload` | object \| null | Metadata for the active aggregate preload |
| `preloadLocked` | boolean | Whether preloads are locked for field use |
| `preloadTx` | array | TX client rows (empty if dataset is large) |
| `preloadTxLarge` | boolean | `true` when TX rows exceed inline limit; use `/api/field/tx-clients` instead |
| `txIndex` | object \| null | Facility index when `preloadTxLarge` is true |
| `preloadAgg` | array | Aggregate preload rows |
| `aggIndicators` | array | Indicator names from aggregate preload |

**`part=saved` response:**

```json
{
  "txSaved": [],
  "aggSaved": [],
  "issuesSaved": []
}
```

**`part=all`:** combines both payloads above.

Field users receive preload and saved data scoped to their assigned state.

---

### `GET /api/field/tx-clients`

Paginated TX client list from the active TX preload. Used when the preload is too large to inline in bootstrap.

**Query parameters:**

| Param      | Required | Description |
|------------|----------|-------------|
| `facility` | Yes      | Facility name (exact match) |
| `state`    | No       | Further filter by state |
| `q`        | No       | Search PepID / patient ID (case-insensitive) |
| `offset`   | No       | Pagination offset (default `0`) |

**Success (`200`):**

```json
{
  "clients": [],
  "total": 1200,
  "hasMore": true
}
```

Page size is 500 rows. **Errors:** `400` if `facility` is missing.

---

## TX validations (client-level)

Natural key for upsert: `period` + `facilityName` + `patientId` + `pepId`.

### `GET /api/tx`

List TX validation records.

**Query parameters:** `period`, `state`, `facilityName` (all optional filters)

**Success (`200`):** Array of `TxValidation` records (newest `updatedAt` first).

---

### `POST /api/tx`

Create or update a single TX validation row (upsert by natural key).

**Required fields:** `period`, `facilityName`, `state`, `assessor`

**Body:** Any `TxValidation` fields. `state` defaults to the session user’s state if omitted.

**Success:** `200` (updated) or `201` (created) — full record in response.

**Example:**

```json
{
  "period": "FY26Q2",
  "periodFy": "FY26",
  "state": "Oyo",
  "lga": "Ibadan North",
  "facilityName": "Ikire Specialist Hospital",
  "datimCode": "NGA-123",
  "patientId": "P001",
  "pepId": "PEP001",
  "assessor": "Jane Doe",
  "assessmentDate": "2026-06-15",
  "recordFound": "Yes",
  "folderSex": "F",
  "emrSex": "F",
  "folderCompleteCount": 8,
  "matchCount": 7,
  "concurrencePct": 87.5,
  "mismatchResolutions": {}
}
```

---

### `DELETE /api/tx`

**HQ only.** Bulk delete TX validations.

**Query parameters:** `period`, `state` (optional filters; omit both to delete all)

**Success (`200`):**

```json
{ "deleted": 42 }
```

---

## Aggregate validations

Natural key for upsert: `period` + `facilityName` + `indicator`.

### `GET /api/agg`

**Query parameters:** `period`, `state`, `facilityName`, `indicator`

**Success (`200`):** Array of `AggValidation` records.

---

### `POST /api/agg`

Create or update one or more aggregate rows.

**Body:** Single object or array of objects. Each item needs `period`, `facilityName`, `indicator`, and `assessor`. Items missing required fields are skipped silently.

**Success (`201`):** Array of saved records.

**Example:**

```json
[
  {
    "period": "FY26Q2",
    "state": "Oyo",
    "facilityName": "Ikire Specialist Hospital",
    "indicator": "TX_CURR",
    "reported": 120,
    "validated": 118,
    "concurrencePct": 98.3,
    "classification": "Concordant",
    "assessor": "Jane Doe"
  }
]
```

---

### `DELETE /api/agg`

**HQ only.** Bulk delete aggregate validations.

**Query parameters:** `period`, `state`

**Success (`200`):**

```json
{ "deleted": 15 }
```

---

## Issues & actions

### `GET /api/issues`

**Query parameters:** `period`, `state`, `status`

**Success (`200`):** Array of `Issue` records.

---

### `POST /api/issues`

Create or update an issue.

- Include `id` in the body to **update** an existing issue.
- Omit `id` to **create** a new issue.
- `assessor` is required.

**Issue fields:**

| Field | Type | Notes |
|-------|------|-------|
| `date` | string | |
| `period` | string | |
| `state` | string | |
| `facility` | string | |
| `thematicArea` | string | |
| `gap` | string | |
| `whyGapExists` | string | |
| `proposedSolution` | string | |
| `requiredResources` | string | |
| `responsiblePerson` | string | |
| `assessor` | string | Required |
| `expectedResult` | string | |
| `identifiedDate` | string | |
| `dueDate` | string | |
| `status` | string | e.g. `Pending`, `In Progress`, `Resolved`, `Escalated` |
| `statusDate` | string | |
| `otherComments` | string | |

**Success:** `200` (update) or `201` (create)

---

### `DELETE /api/issues`

**HQ only.**

**Query parameters:**

- `id` — delete a single issue, or
- `period` + `state` — bulk delete

**Success (`200`):**

```json
{ "deleted": 1 }
```

---

## Preloads

HQ uploads EMR Excel files that field teams use for validation.

### `GET /api/preloads`

List preload metadata (no row data).

**Query parameters:** `type` — `tx` or `agg`

**Success (`200`):**

```json
[
  {
    "id": 1,
    "type": "tx",
    "period": "FY26Q2",
    "state": null,
    "uploadedBy": "Admin",
    "locked": true,
    "createdAt": "2026-06-01T10:00:00.000Z"
  }
]
```

---

### `POST /api/preloads`

**HQ only.** Upload an Excel preload file.

**Content type:** `multipart/form-data`

| Field    | Required | Description |
|----------|----------|-------------|
| `file`   | Yes      | `.xlsx` / `.xls` file |
| `type`   | Yes      | `tx` or `agg` |
| `period` | No       | DQA period label |
| `state`  | No       | State scope |

**Success (`201`):** Full preload record including parsed `data` JSON.

**Errors:** `400` if file is empty or unparseable.

---

### `GET /api/preloads/:id`

Get a single preload including full `data` payload.

**Success (`200`):** Preload object. **Errors:** `404` if not found.

---

### `PATCH /api/preloads/:id`

**HQ only.** Lock or unlock a preload for field use.

**Body:**

```json
{ "locked": true }
```

**Success (`200`):** Updated preload record.

---

### `DELETE /api/preloads/:id`

**HQ only.** Delete a preload.

**Success (`200`):**

```json
{ "ok": true }
```

---

## Users

**All endpoints HQ only.**

### `GET /api/users`

List users (passwords never returned).

**Success (`200`):**

```json
[
  {
    "id": 1,
    "name": "Field User",
    "email": "field@ecews.org",
    "role": "field",
    "state": "Oyo",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
]
```

---

### `POST /api/users`

Create a user.

**Body:**

```json
{
  "name": "Field User",
  "email": "field@ecews.org",
  "password": "secure-password",
  "role": "field",
  "state": "Oyo"
}
```

`role` defaults to `field`. `state` is optional (typically set for field users).

**Success (`201`):** User object (no password). **Errors:** `409` if email exists.

---

### `DELETE /api/users?id=:id`

Delete a user by ID. Cannot delete your own account.

**Success (`200`):**

```json
{ "ok": true }
```

---

## Data models (summary)

Full schema: `prisma/schema.prisma`.

### TxValidation

Client-level TX_NEW validation. Key fields: demographics, 9 folder/EMR element pairs, completeness/concurrence metrics, `mismatchResolutions` (JSON), `remarks`.

### AggValidation

Facility-level indicator validation. Key fields: `indicator`, `reported`, `validated`, `concurrencePct`, `classification`, `mismatchResolution` (JSON).

### Issue

Gap tracking and accountability log with `dueDate`, `status`, and responsible person.

### Preload

Parsed Excel data stored as JSON. `type` is `tx` or `agg`. Field pages only use `locked: true` preloads.

---

## Example workflow (curl)

```bash
# 1. Log in and save cookie
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ecews.org","password":"DQA2025!"}'

# 2. Check session
curl -s -b cookies.txt http://localhost:3000/api/auth/me

# 3. Load field bootstrap data
curl -s -b cookies.txt "http://localhost:3000/api/field/bootstrap?part=all"

# 4. List TX validations for a period
curl -s -b cookies.txt "http://localhost:3000/api/tx?period=FY26Q2&state=Oyo"

# 5. Log out
curl -s -b cookies.txt -X POST http://localhost:3000/api/auth/logout
```

---

## Notes

- There is **no separate report export API**. TX_NEW, Aggregate, and Issues reports are built client-side from validation data and exported in the browser.
- Reports and analytics in the HQ UI read the same `/api/tx`, `/api/agg`, and `/api/issues` endpoints (or Prisma directly on server pages).
- Session cookie name: `dqa_session`. Set `COOKIE_SECURE=true` in production when served over HTTPS.
