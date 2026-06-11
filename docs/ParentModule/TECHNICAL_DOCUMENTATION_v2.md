# XKorienta — Technical Documentation (Updated)

> **Module:** Parent Authentication + Child Management  
> **Tickets:** XKT-001 · XKT-002 · XKT-003  
> **Stack:** Next.js 14 · TypeScript · MongoDB (Mongoose) · bcryptjs · jsonwebtoken · Zod  
> **Last Updated:** 2025-06-03

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Layer Responsibilities](#layer-responsibilities)
3. [File Structure](#file-structure)
4. [Data Models](#data-models)
5. [Registration Flow (XKT-001)](#registration-flow-xkt-001)
6. [Login Flow (XKT-002)](#login-flow-xkt-002)
7. [Child Linking Flow (XKT-003)](#child-linking-flow-xkt-003)
8. [ABAC Guard (assertAccess)](#abac-guard-assertaccess)
9. [Error Handling System](#error-handling-system)
10. [Testing Strategy](#testing-strategy)

---

## Architecture Overview

Strict **4-layer architecture**:

```
HTTP Request
     │
     ▼
┌─────────────────────┐
│   Route Handler     │  route.ts          — parse, delegate, catch
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Controller        │  *Controller.ts     — validate (Zod), shape response
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Service           │  *Service.ts        — business logic, ABAC guard
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Repository        │  *Repository.ts     — DB access only
└─────────────────────┘
```

**Rule:** Each layer only talks to the layer directly below.

---

## Layer Responsibilities

### Route Handler (`route.ts`)

- Parse `request.json()` → catch malformed JSON → 400
- Call controller method
- Catch `ParentError` → format with `ApiResponse.error()`
- Catch unknown errors → `ApiResponse.internalError()`

### Controller (`*Controller.ts`)

- Validate request body with **Zod schemas**
- Wrap Zod errors in `ParentError` with code `VAL_00X`
- Call service
- Convert MongoDB `ObjectId` → `string` before returning

### Service (`*Service.ts`)

- **All business logic** lives here
- **ABAC guard** `assertAccess()` is called FIRST in all protected methods
- Orchestrates repositories, external APIs, calculations
- Throws typed `ParentError` for every known failure

### Repository (`*Repository.ts`)

- Only Mongoose calls
- Always calls `connectDB()` before queries
- No business logic — just CRUD

---

## File Structure

```
src/
├── app/
│   └── api/
│       └── parent/
│           ├── auth/
│           │   ├── register/
│           │   │   └── route.ts              ← XKT-001
│           │   └── login/
│           │       └── route.ts              ← XKT-002
│           └── children/
│               ├── [learnerId]/
│               │   ├── link/
│               │   │   └── route.ts          ← XKT-003
│               │   └── validate/
│               │       └── route.ts          ← XKT-004 (admin)
│               └── route.ts                  ← XKT-005 (list children)
│
├── lib/
│   ├── controllers/
│   │   ├── ParentAuthController.ts          ← XKT-001, 002
│   │   └── ParentChildController.ts         ← XKT-003, 004, 005
│   ├── services/
│   │   ├── ParentAuthService.ts             ← XKT-001, 002
│   │   └── ParentLearnerService.ts          ← XKT-003, ABAC guard
│   ├── repositories/
│   │   ├── ParentProfileRepository.ts
│   │   └── ParentLearnerRepository.ts       ← XKT-003
│   ├── errors/
│   │   ├── BaseError.ts
│   │   └── ParentError.ts
│   └── utils/
│       ├── apiResponse.ts
│       └── env.ts
│
├── models/
│   ├── ParentProfile.ts
│   ├── ParentLearnerLink.ts                 ← XKT-003
│   ├── User.ts
│   ├── Invitation.ts
│   └── enums.ts
│
└── __tests__/
    ├── unit/
    │   ├── ParentAuthService.test.ts
    │   ├── ParentAuthController.test.ts
    │   ├── ParentLearnerService.test.ts     ← XKT-003
    │   └── ParentChildController.test.ts    ← XKT-003
    └── integration/
        ├── auth.route.test.ts
        └── childLinking.route.test.ts       ← XKT-003
```

---

## Data Models

### ParentLearnerLink (NEW for XKT-003)

Represents the parent-child relationship and linking status.

| Field | Type | Default | Notes |
|---|---|---|---|
| `_id` | ObjectId | — | Primary key |
| `parent` | ObjectId ref ParentProfile | — | **Required, indexed** |
| `learner` | ObjectId ref User | — | **Required, indexed** |
| `relationshipType` | Enum | — | FATHER, MOTHER, GUARDIAN, OTHER |
| `isPrimary` | boolean | `true` | Primary contact for school |
| `status` | Enum | `PENDING` | PENDING, ACTIVE, REVOKED |
| `validatedBy` | ObjectId ref User | — | Admin who approved (set in XKT-004) |
| `validatedAt` | Date | — | When approved (set in XKT-004) |
| `rejectionReason` | string | — | If rejected in XKT-004 |
| `revokedAt` | Date | — | When revoked by parent |
| `revocationReason` | string | — | Why parent revoked |
| `lastAccessedAt` | Date | — | Last dashboard access |
| `createdAt` | Date (auto) | — | Request timestamp |
| `updatedAt` | Date (auto) | — | Last update |

**Indexes:**
```typescript
{ parent: 1, learner: 1 }  // UNIQUE - prevent duplicate links
{ parent: 1, status: 1 }   // Find children by parent, status
{ learner: 1, status: 1 }  // Find parents of learner
```

### ParentProfile (Updated)

No changes to schema, but `isActive` field is now critical:
- `true` = parent can login AND request links
- `false` = account disabled (set when KYC fails, etc.)

---

## Registration Flow (XKT-001)

```
POST /api/parent/auth/register
         │
         ▼
[route.ts] parse JSON
         │ ❌ invalid JSON → 400 BAD_REQUEST
         ▼
[controller] Zod validate (VAL_001)
         │ ❌ schema error  → 400 VAL_001
         ▼
[service] find Invitation (token, PENDING, !expired)
         │ ❌ not found / expired → 400 PAR_005
         ▼
[service] find User by email
         │ ❌ email exists → 409 PAR_004
         ▼
[service] bcrypt.hash(password, 12)
         ▼
[service] User.save() → new user
         ▼
[service] parentProfileRepository.create()
         ▼
[service] invitation.status = 'ACCEPTED' → save()
         ▼
[controller] stringify ObjectIds
         ▼
[route.ts] ApiResponse.created() → 201
```

---

## Login Flow (XKT-002)

```
POST /api/parent/auth/login
         │
         ▼
[route.ts] parse JSON → 400
         ▼
[controller] Zod validate → 400 VAL_002
         ▼
[service] User.findOne({ email, role: PARENT })
         │ ❌ → 404 PAR_001
         ▼
[service] parentProfileRepository.findById(user._id)
         │ ❌ → 404 PAR_001
         ▼
[service] bcrypt.compare(password, user.password)
         │ ❌ mismatch  → 401 PAR_002
         ▼
[service] check isActive && !accountDisabledAt
         │ ❌ disabled  → 403 PAR_003
         ▼
[service] generateAccessToken() + generateRefreshToken()
         ▼
[route.ts] ApiResponse.ok() → 200
```

---

## Child Linking Flow (XKT-003)

```
POST /api/parent/children/{learnerId}/link
         │
         ▼
[route.ts] parse JSON → 400 BAD_REQUEST
         ▼
[controller] Zod validate (VAL_003)
         │ ❌ invalid enum → 400
         ▼
[controller] extract parentId from JWT token
         ▼
[service] User.findById(learnerId)
         │ ❌ not found → 404 PAR_010
         ▼
[service] parentLearnerRepository.findActiveLink(parent, learner)
         │ ❌ exists → 409 PAR_009
         ▼
[service] parentLearnerRepository.findPendingLink(parent, learner)
         │ ❌ exists → 409 PAR_011
         ▼
[service] parentLearnerRepository.create({
         │   parent, learner, relationshipType, isPrimary, status: PENDING
         │ })
         ▼
[service] auditLog.log("LINK_REQUESTED", ...)
         ▼
[controller] stringify ObjectIds
         ▼
[route.ts] ApiResponse.created() → 201
```

---

## ABAC Guard (assertAccess)

**Location:** `ParentLearnerService.assertAccess(parentId, learnerId)`

**Purpose:** Prevent parent A from accessing parent B's child data

**Must be called as FIRST LINE** in all methods that read child data:

```typescript
async getDashboard(parentId, learnerId) {
  // ⭐ CRITICAL - call FIRST, before any DB queries
  await this.assertAccess(parentId, learnerId);
  
  // Only executes if parent is linked to learner
  const data = await getChildData(learnerId);
  return data;
}
```

### How It Works

```
assertAccess(parentId, learnerId)
         │
         ▼
[repository] find ParentLearnerLink where:
  parent = parentId AND
  learner = learnerId AND
  status = 'ACTIVE'  ← Only ACTIVE links allowed!
         │
         ├─ ✅ FOUND → return true (access granted)
         │
         └─ NOT FOUND → throw ParentError.linkNotFound() (403 PAR_008)
```

### Attack Prevention

**Without ABAC:**
```
Parent A (ID: 111):
GET /api/parent/children/999/dashboard
→ Returns Child 999 data
→ Data leak! (Parent A not linked to 999)
```

**With ABAC:**
```
Parent A (ID: 111):
GET /api/parent/children/999/dashboard
→ assertAccess(111, 999)
→ No ACTIVE link found
→ ParentError.linkNotFound() (403 PAR_008)
→ Access denied ✅
```

---

## Error Handling System

### ParentError Factory Methods

```typescript
ParentError.parentNotFound()           // PAR_001
ParentError.invalidCredentials()       // PAR_002
ParentError.accountDisabled()          // PAR_003
ParentError.emailAlreadyExists()       // PAR_004
ParentError.invitationInvalidOrExpired() // PAR_005
ParentError.learnerNotFound()          // PAR_010
ParentError.linkNotFound()             // PAR_008 (ABAC)
ParentError.alreadyLinked()            // PAR_009
ParentError.linkAlreadyPending()       // PAR_011
```

Add new factory methods as new tickets introduce new errors.

---

## Testing Strategy

### Unit Tests

**Files:**
- `ParentAuthService.test.ts` - auth logic, bcrypt, JWT
- `ParentAuthController.test.ts` - input validation, response formatting
- `ParentLearnerService.test.ts` - link creation, ABAC guard
- `ParentChildController.test.ts` - child management validation

**Mocking:**
- `User`, `ParentProfile`, `ParentLearnerLink` models
- `bcryptjs`, `jsonwebtoken`
- All repositories

**Coverage Target:** 100% lines, branches, functions, statements

### Integration Tests

**Files:**
- `auth.route.test.ts` - POST /auth/register, POST /auth/login
- `childLinking.route.test.ts` - POST /children/{learnerId}/link

**Mocking:** Database layer only (real MongoDB test instance)

**Test Cases:**
- Happy paths (201, 200 responses)
- All error codes (400, 401, 403, 404, 409, 500)
- Edge cases (duplicate links, pending links, etc.)
- ABAC guard (parent can't access other parent's child)

---

## Security Decisions

| Decision | Rationale |
|---|---|
| ABAC guard FIRST LINE | Prevents accidental data leak before any queries |
| Invitation-only registration | Only authorized people can create parent accounts |
| JWT stateless tokens | Works with mobile apps, scales better |
| Email lowercase | Prevents case-sensitivity bugs |
| `status: PENDING` on link request | Admin must approve before parent sees child data |
| Two-separate lockout mechanisms | `isActive` AND `accountDisabledAt` for flexibility |

---

*This document covers XKT-001, XKT-002, and XKT-003. Append new sections as tickets arrive.*
