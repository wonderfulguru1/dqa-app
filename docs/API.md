# ECEWS DQA Companion — API Reference

REST-style JSON API served by the Next.js app under `/api`.

| | |
|---|---|
| **Base URL (local dev)** | `http://localhost:3000` |
| **Web documentation** | `http://localhost:3000/docs` |
| **Content type** | `application/json` unless noted otherwise |
| **Session cookie** | `dqa_session` (HTTP-only JWT, 8-hour expiry) |

---

## Endpoint index

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/login` | Public | Log in, receive session cookie |
| `POST` | `/api/auth/logout` | Session | Clear session |
| `GET` | `/api/auth/me` | Session | Current user profile |
| `GET` | `/api/field/bootstrap` | Session | Preloads + saved data for field app |
| `GET` | `/api/field/tx-clients` | Session | Paginated TX clients from preload |
| `GET` | `/api/tx` | Session | List TX validations |
| `POST` | `/api/tx` | Session | Upsert one TX validation |
| `DELETE` | `/api/tx` | HQ | Bulk delete TX validations |
| `GET` | `/api/agg` | Session | List aggregate validations |
| `POST` | `/api/agg` | Session | Upsert aggregate validation(s) |
| `DELETE` | `/api/agg` | HQ | Bulk delete aggregate validations |
| `GET` | `/api/issues` | Session | List issues |
| `POST` | `/api/issues` | Session | Create or update an issue |
| `DELETE` | `/api/issues` | HQ | Delete issue(s) |
| `GET` | `/api/preloads` | Session | List preload metadata |
| `POST` | `/api/preloads` | HQ | Upload Excel preload |
| `GET` | `/api/preloads/:id` | Session | Get preload with full `data` |
| `PATCH` | `/api/preloads/:id` | HQ | Lock/unlock preload |
| `DELETE` | `/api/preloads/:id` | HQ | Delete preload |
| `GET` | `/api/users` | HQ | List users |
| `POST` | `/api/users` | HQ | Create user |
| `DELETE` | `/api/users?id=:id` | HQ | Delete user |

---

## Authentication

All endpoints except `POST /api/auth/login` require a valid session.

### How sessions work

1. Call `POST /api/auth/login` with email and password.
2. The server sets an HTTP-only cookie named `dqa_session`.
3. Send that cookie on every subsequent request (`credentials: 'include'` in `fetch`, or `-b cookies.txt` with curl).

JWT payload fields: `id`, `name`, `email`, `role`, `state`.

### Roles

| Role | Access |
|------|--------|
| `field` | Data for assigned `state` only; cannot upload preloads, manage users, or bulk-delete |
| `hq` | All states; preload upload/lock, user CRUD, bulk deletes, HQ dashboards |

### Field state scoping

Field users with a `state` on their account are automatically scoped:

| Endpoint | Scoping behaviour |
|----------|-------------------|
| `GET /api/tx` | Filters to `session.state` when no `state` query param |
| `GET /api/agg` | Same |
| `GET /api/issues` | Same |
| `GET /api/field/bootstrap` | Preload rows and saved records filtered to `session.state` |
| `GET /api/field/tx-clients` | Rows filtered to `session.state` before pagination |
| `POST /api/tx`, `POST /api/agg` | `state` defaults to `session.state` if omitted in body |

State matching is **case-insensitive** when filtering preload rows.

### Preload locking (field access)

| Role | Active preload selection |
|------|--------------------------|
| **HQ** | Latest upload per type (`tx` / `agg`), locked or not |
| **Field** | Latest **locked** upload per type; unlocked preloads are ignored |

HQ must upload Excel preloads and set `locked: true` via `PATCH /api/preloads/:id` before field teams can see line-list data.

---

## Error responses

Errors are JSON objects with an `error` string:

```json
{ "error": "Unauthorized" }
```

| Status | Meaning |
|--------|---------|
| `400` | Missing or invalid request data |
| `401` | Not logged in |
| `403` | Logged in but insufficient role (usually HQ-only) |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate email) |
| `500` | Server error |

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
  "name": "DQA Admin"
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
  "name": "DQA Admin",
  "email": "admin@ecews.org",
  "role": "hq",
  "state": null
}
```

Field user example:

```json
{
  "id": 3,
  "name": "Osun",
  "email": "osun@ecews.org",
  "role": "field",
  "state": "Osun"
}
```

**Errors:** `401` if not authenticated

---

## Field bootstrap

Primary endpoint for the field data-entry UI. Loads preloads and/or saved validations.

### `GET /api/field/bootstrap`

**Query parameters:**

| Param | Values | Default | Description |
|-------|--------|---------|-------------|
| `part` | `preloads`, `saved`, `all` | `preloads` | Which data bundle to return |

#### `part=preloads` response

| Field | Type | Description |
|-------|------|-------------|
| `activeTxPreload` | object \| null | Metadata for active TX preload (`id`, `type`, `period`, `state`, `uploadedBy`, `locked`, `createdAt`, `updatedAt`) |
| `activeAggPreload` | object \| null | Metadata for active aggregate preload |
| `preloadLocked` | boolean | HQ: any preload exists. Field: at least one locked preload exists |
| `preloadTx` | array | TX client rows; **empty** when `preloadTxLarge` is true |
| `preloadTxLarge` | boolean | `true` when row count exceeds 1,500; use `/api/field/tx-clients` |
| `txIndex` | object \| null | Present when `preloadTxLarge` is true (see below) |
| `preloadAgg` | array | Aggregate facility rows for the user's state |
| `aggIndicators` | array | Indicator column names from aggregate preload |

**`txIndex` shape** (large TX preloads):

```json
{
  "states": ["Osun"],
  "facilitiesByState": {
    "Osun": ["Facility A", "Facility B"]
  },
  "totalRows": 33540
}
```

#### `part=saved` response

```json
{
  "txSaved": [],
  "aggSaved": [],
  "issuesSaved": []
}
```

Saved TX/agg rows use trimmed field selects (report-relevant columns only). Issues return full records.

#### `part=all`

Merges both payloads above into one JSON object.

**Field scoping:** `preloadTx`, `preloadAgg`, `txSaved`, `aggSaved`, and `issuesSaved` are filtered to the field user's assigned `state`.

---

### `GET /api/field/tx-clients`

Paginated TX client list from the active locked TX preload. Used when bootstrap sets `preloadTxLarge: true`.

**Query parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `facility` | Yes | Facility name (exact match, trimmed) |
| `state` | No | Further filter by state |
| `q` | No | Search PepID / patient ID (case-insensitive) |
| `offset` | No | Pagination offset (default `0`) |

**Success (`200`):**

```json
{
  "clients": [],
  "total": 1200,
  "hasMore": true
}
```

- Page size: **500** rows
- Returns `{ "clients": [], "total": 0 }` when no active preload exists
- **Errors:** `400` if `facility` is missing

---

## TX validations (client-level)

**Natural key (upsert):** `period` + `facilityName` + `patientId` + `pepId`

### `GET /api/tx`

List TX validation records.

**Query parameters:** `period`, `state`, `facilityName` (all optional)

**Success (`200`):** Array of `TxValidation` records, newest `updatedAt` first.

---

### `POST /api/tx`

Create or update a single TX validation row.

**Required:** `period`, `facilityName`, `state`, `assessor`

**Body:** Any `TxValidation` field. `state` defaults to `session.state` for field users.

**Success:** `200` (updated) or `201` (created)

**Example:**

```json
{
  "period": "FY26Q2",
  "periodFy": "FY26",
  "state": "Osun",
  "lga": "Osogbo",
  "facilityName": "State Hospital Osogbo",
  "datimCode": "NGA-456",
  "patientId": "P001",
  "pepId": "PEP001",
  "assessor": "Field Assessor",
  "assessmentDate": "2026-07-07",
  "recordFound": "Yes",
  "folderSex": "F",
  "emrSex": "F",
  "folderCompleteCount": 8,
  "matchCount": 7,
  "concurrencePct": 87.5,
  "mismatchResolutions": {
    "sex": {
      "gap": "Folder missing",
      "whyGapExists": "Record not filed",
      "proposedSolution": "Update folder",
      "expectedResult": "EMR and folder match",
      "requiredResources": "Clerk time",
      "dueDate": "2026-07-15",
      "status": "Pending",
      "otherComments": ""
    }
  },
  "remarks": ""
}
```

---

### `DELETE /api/tx`

**HQ only.** Bulk delete TX validations.

**Query parameters:** `period`, `state` (optional; omit both to delete all)

**Success (`200`):**

```json
{ "deleted": 42 }
```

---

## Aggregate validations

**Natural key (upsert):** `period` + `facilityName` + `indicator`

### `GET /api/agg`

**Query parameters:** `period`, `state`, `facilityName`, `indicator`

**Success (`200`):** Array of `AggValidation` records.

---

### `POST /api/agg`

Create or update one or more aggregate rows.

**Body:** Single object or array. Each item needs `period`, `facilityName`, `indicator`, and `assessor`. Items missing required fields are **skipped silently**.

**Success (`201`):** Array of saved records.

**Example:**

```json
[
  {
    "period": "FY26Q2",
    "periodFy": "FY26",
    "state": "Osun",
    "lga": "Osogbo",
    "facilityName": "State Hospital Osogbo",
    "indicator": "TX_CURR",
    "reported": 120,
    "validated": 118,
    "concurrencePct": 98.3,
    "classification": "Concordant",
    "assessor": "Field Assessor",
    "mismatchResolution": {
      "gap": "Count mismatch",
      "whyGapExists": "Register not updated",
      "proposedSolution": "Reconcile registers",
      "expectedResult": "Counts align",
      "requiredResources": "Data officer",
      "dueDate": "2026-07-20",
      "status": "Ongoing",
      "otherComments": ""
    }
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

**Success (`200`):** Array of `Issue` records, newest `createdAt` first.

---

### `POST /api/issues`

Create or update an issue.

- Include `id` in the body to **update**
- Omit `id` to **create**
- `assessor` is required

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
| `assessor` | string | **Required** |
| `expectedResult` | string | |
| `identifiedDate` | string | |
| `dueDate` | string | |
| `status` | string | `Pending`, `In Progress`, `Resolved`, `Escalated` |
| `statusDate` | string | |
| `otherComments` | string | |

**Success:** `200` (update) or `201` (create)

---

### `DELETE /api/issues`

**HQ only.**

**Query parameters:**

- `id` — delete one issue, or
- `period` + `state` — bulk delete

**Success (`200`):**

```json
{ "deleted": 1 }
```

---

## Preloads

HQ uploads EMR Excel line lists (`tx`) and DHIS aggregate data (`agg`) before field visits.

### `GET /api/preloads`

List preload metadata (no row `data`).

**Query parameters:** `type` — `tx` or `agg`

**Success (`200`):**

```json
[
  {
    "id": 10,
    "type": "tx",
    "period": null,
    "state": null,
    "uploadedBy": "DQA Admin",
    "locked": true,
    "createdAt": "2026-07-03T14:59:55.851Z"
  }
]
```

---

### `POST /api/preloads`

**HQ only.** Upload an Excel preload file.

**Content type:** `multipart/form-data`

| Field | Required | Description |
|-------|----------|-------------|
| `file` | Yes | `.xlsx` / `.xls` file |
| `type` | Yes | `tx` or `agg` |
| `period` | No | DQA period label (e.g. `FY26Q2`) |
| `state` | No | State scope metadata on the preload record |

Excel is parsed server-side; rows are normalized to canonical field names (`state`, `facilityName`, `dqaPeriod`, etc.).

**Success (`201`):** Full preload record including parsed `data` JSON array.

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

Field users only receive data from the latest **locked** preload per type.

**Success (`200`):** Updated preload record.

---

### `DELETE /api/preloads/:id`

**HQ only.**

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
    "name": "DQA Admin",
    "email": "admin@ecews.org",
    "role": "hq",
    "state": null,
    "createdAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": 3,
    "name": "Osun",
    "email": "osun@ecews.org",
    "role": "field",
    "state": "Osun",
    "createdAt": "2026-07-07T19:40:00.000Z"
  }
]
```

---

### `POST /api/users`

Create a field or HQ user.

**Body:**

```json
{
  "name": "Osun",
  "email": "osun@ecews.org",
  "password": "secure-password",
  "role": "field",
  "state": "Osun"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `name` | Yes | Display name |
| `email` | Yes | Unique login email |
| `password` | Yes | Stored bcrypt-hashed |
| `role` | No | `field` (default) or `hq` |
| `state` | No | **Required for field users** — must match `state` values in preload Excel (e.g. `Osun`, `Delta`) |

**Success (`201`):** User object (no password). **Errors:** `409` if email exists.

---

### `DELETE /api/users?id=:id`

Delete a user by ID. Cannot delete your own account.

**Success (`200`):**

```json
{ "ok": true }
```

---

## Data models

Full Prisma schema: `prisma/schema.prisma`

### User

| Field | Type | Notes |
|-------|------|-------|
| `id` | int | Auto-increment |
| `name` | string | |
| `email` | string | Unique |
| `role` | string | `field` \| `hq` |
| `state` | string? | Assigned state for field users |

### Preload

| Field | Type | Notes |
|-------|------|-------|
| `type` | string | `tx` \| `agg` |
| `data` | JSON | Array of normalized row objects |
| `locked` | boolean | Must be `true` for field access |
| `period`, `state` | string? | Upload metadata |

### Mismatch resolution (JSON)

Used in `TxValidation.mismatchResolutions` (map keyed by field name) and `AggValidation.mismatchResolution` (single object per indicator row).

| Field | Type | Notes |
|-------|------|-------|
| `gap` | string | **Required** — issues/gaps description |
| `whyGapExists` | string | |
| `proposedSolution` | string | |
| `expectedResult` | string | |
| `requiredResources` | string | |
| `dueDate` | string | ISO date `YYYY-MM-DD` |
| `status` | string | `Pending` (default), `Ongoing`, or `Completed` |
| `otherComments` | string | |

Returned on `GET /api/tx` and `GET /api/agg`. Accepted on `POST /api/tx` and `POST /api/agg`.

### TxValidation

Client-level TX_NEW validation: demographics, 9 folder/EMR element pairs, completeness/concurrence metrics, `mismatchResolutions` (JSON map), `remarks`.

Unique: `[period, facilityName, patientId, pepId]`

### AggValidation

Facility indicator validation: `indicator`, `reported`, `validated`, `concurrencePct`, `classification`, `mismatchResolution` (JSON).

### Issue

Gap tracking log with `dueDate`, `status`, `responsiblePerson`, etc.

---

## Example workflows

### HQ: upload and lock preloads

```bash
# Log in as HQ
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ecews.org","password":"DQA2025!"}'

# Upload TX line list
curl -s -b cookies.txt -X POST http://localhost:3000/api/preloads \
  -F "file=@tx-line-list.xlsx" -F "type=tx" -F "period=FY26Q2"

# Lock preload (use id from upload response)
curl -s -b cookies.txt -X PATCH http://localhost:3000/api/preloads/10 \
  -H "Content-Type: application/json" \
  -d '{"locked":true}'
```

### Field user (Osun): load data

```bash
# Log in as Osun field user
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"osun@ecews.org","password":"YOUR_PASSWORD"}'

# Session check — state should be "Osun"
curl -s -b cookies.txt http://localhost:3000/api/auth/me

# Load preloads + saved validations (Osun-scoped)
curl -s -b cookies.txt "http://localhost:3000/api/field/bootstrap?part=all"

# Paginated clients for a facility (large TX preloads)
curl -s -b cookies.txt \
  "http://localhost:3000/api/field/tx-clients?facility=State%20Hospital%20Osogbo&offset=0"

# List saved TX validations
curl -s -b cookies.txt "http://localhost:3000/api/tx?state=Osun"
```

### HQ: create a state field user

```bash
curl -s -b cookies.txt -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Delta",
    "email": "delta@ecews.org",
    "password": "secure-password",
    "role": "field",
    "state": "Delta"
  }'
```

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing session JWTs |
| `COOKIE_SECURE` | Set `true` when served over HTTPS |
| `SEED_EMAIL`, `SEED_PASSWORD` | Optional overrides for `node prisma/seed.js` |

---

## Notes

- **Web docs:** Browse `http://localhost:3000/docs` for this reference in the browser (no login required).
- **No report export API:** TX_NEW, Aggregate, and Issues reports are built client-side and exported in the browser.
- **HQ dashboards** use the same `/api/tx`, `/api/agg`, `/api/issues` endpoints or Prisma directly on server pages.
- **Field user with no matching preload data** (e.g. `state: "Delta"` but preloads contain only `Osun`) receives empty arrays from bootstrap — upload and lock preloads that include that state.
