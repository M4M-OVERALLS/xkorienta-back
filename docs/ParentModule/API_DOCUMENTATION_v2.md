# XKorienta — Parent Auth API Documentation

> **Module:** Parent Authentication + Child Management  
> **Base URL:** `/api/parent`  
> **Ticket Range:** XKT-001 · XKT-002 · XKT-003  
> **Last Updated:** 2025-06-03

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Response Envelope](#response-envelope)
4. [Error Codes](#error-codes)
5. [Endpoints](#endpoints)
   - [Authentication](#authentication-endpoints)
     - [POST /auth/register](#post-authregister)
     - [POST /auth/login](#post-authlogin)
   - [Child Management](#child-management-endpoints)
     - [POST /children/{learnerId}/link](#post-childrenlearneridlink)

---

## Overview

The Parent API handles **registration**, **login**, and **child linking** for parent accounts.

### Flow Summary

**Registration & Login:**
```
[School Admin creates invitation] → [Parent receives token]
         ↓
POST /auth/register  (invitationToken + personal data)  →  201
         ↓
POST /auth/login     (email + password)                 →  200 + JWT
```

**Child Linking (XKT-003):**
```
[Parent requests to link to child]
         ↓
POST /children/{learnerId}/link  (relationshipType)  →  201 + PENDING status
         ↓
[Admin approves] → status: ACTIVE → Parent can access dashboard
```

---

## Authentication

After login, all protected routes require a **Bearer token** in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

| Token | Lifetime | Purpose |
|---|---|---|
| `accessToken` | 1 hour | Access protected API routes |
| `refreshToken` | 7 days | Obtain new access token (future endpoint) |

Tokens are signed with `NEXTAUTH_SECRET` using HS256 (JWT).

**Access token payload:**
```json
{
  "userId": "...",
  "parentProfileId": "...",
  "email": "parent@example.com",
  "role": "PARENT",
  "kycLevel": 0,
  "iss": "xkorienta-parent-module",
  "sub": "<userId>",
  "exp": 1234567890
}
```

---

## Response Envelope

All responses use a consistent envelope:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "severity": "WARNING | ERROR | CRITICAL",
    "category": "VALIDATION | AUTHENTICATION | ...",
    "timestamp": "2025-06-03T10:00:00.000Z"
  }
}
```

---

## Error Codes

### HTTP Status → Meaning

| Status | When |
|---|---|
| 400 | Malformed JSON, missing required fields, invalid format |
| 401 | Wrong password, missing/invalid token |
| 403 | Account disabled, insufficient KYC, no parent-child link |
| 404 | Parent/learner not found |
| 409 | Email already registered, already linked |
| 500 | Database error, unexpected server error |

### Application Error Codes

| Code | HTTP | Description | Ticket |
|---|---|---|---|
| `BAD_REQUEST` | 400 | Unparseable JSON body | — |
| `VAL_001` | 400 | Registration input validation failed | XKT-001 |
| `VAL_002` | 400 | Login input validation failed | XKT-002 |
| `VAL_003` | 400 | Child linking input validation failed | XKT-003 |
| `PAR_005` | 400 | Invitation token invalid or expired | XKT-001 |
| `PAR_004` | 409 | Email already registered | XKT-001 |
| `PAR_002` | 401 | Invalid email or password | XKT-002 |
| `PAR_003` | 403 | Account disabled | XKT-002 |
| `PAR_001` | 404 | Parent account not found | XKT-001, 002 |
| `PAR_010` | 404 | Learner not found | XKT-003 |
| `PAR_008` | 403 | No active parent-child link (ABAC) | XKT-003+ |
| `PAR_009` | 409 | Parent already linked to this child | XKT-003 |
| `PAR_011` | 409 | Link request already pending review | XKT-003 |
| `PAR_006` | 500 | Database error | — |
| `INTERNAL_ERROR` | 500 | Unexpected server error | — |

---

## Endpoints

---

## Authentication Endpoints

### POST /auth/register

**Ticket:** XKT-001  
**Full path:** `POST /api/parent/auth/register`  
**Auth required:** No

Registers a new parent account. Requires a valid, unused invitation token.

#### Request Body

```json
{
  "invitationToken": "string (required)",
  "name": "string (required)",
  "email": "string (required, valid email)",
  "phone": "string (optional)",
  "password": "string (required, min 8 chars)",
  "language": "\"fr\" | \"en\" (required)"
}
```

#### Success Response — `201 Created`

```json
{
  "success": true,
  "data": {
    "userId": "64a1f2b3c4d5e6f7a8b9c0d1",
    "parentProfileId": "64a1f2b3c4d5e6f7a8b9c0d2",
    "email": "parent@example.com"
  }
}
```

#### Error Responses

**400 — Invalid invitation token (PAR_005)**
```json
{
  "success": false,
  "error": {
    "code": "PAR_005",
    "message": "Invitation token invalid or expired",
    "severity": "WARNING",
    "category": "VALIDATION"
  }
}
```

**409 — Email already registered (PAR_004)**
```json
{
  "success": false,
  "error": {
    "code": "PAR_004",
    "message": "This email is already registered",
    "severity": "WARNING",
    "category": "CONFLICT"
  }
}
```

---

### POST /auth/login

**Ticket:** XKT-002  
**Full path:** `POST /api/parent/auth/login`  
**Auth required:** No

Authenticates a parent and returns JWT access + refresh tokens.

#### Request Body

```json
{
  "email": "string (required, valid email)",
  "password": "string (required)"
}
```

#### Success Response — `200 OK`

```json
{
  "success": true,
  "data": {
    "userId": "64a1f2b3c4d5e6f7a8b9c0d1",
    "parentProfileId": "64a1f2b3c4d5e6f7a8b9c0d2",
    "email": "parent@example.com",
    "name": "Marie Dupont",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "kycLevel": 0
  }
}
```

#### Error Responses

**401 — Wrong password (PAR_002)**
```json
{
  "success": false,
  "error": {
    "code": "PAR_002",
    "message": "Invalid email or password",
    "severity": "WARNING",
    "category": "AUTHENTICATION"
  }
}
```

**403 — Account disabled (PAR_003)**
```json
{
  "success": false,
  "error": {
    "code": "PAR_003",
    "message": "Your account has been disabled",
    "severity": "WARNING",
    "category": "AUTHORIZATION"
  }
}
```

**404 — Parent not found (PAR_001)**
```json
{
  "success": false,
  "error": {
    "code": "PAR_001",
    "message": "Parent account not found"
  }
}
```

---

## Child Management Endpoints

### POST /children/{learnerId}/link

**Ticket:** XKT-003  
**Full path:** `POST /api/parent/children/{learnerId}/link`  
**Auth required:** Yes (Bearer JWT)  
**Status:** Creates PENDING link request (awaits admin approval)

Parent requests to link to a child. The link starts in `PENDING` status and must be approved by a school admin before the parent can access the child's dashboard.

#### URL Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `learnerId` | string (ObjectId) | ✓ | MongoDB ID of the student to link |

#### Request Body

```json
{
  "relationshipType": "\"FATHER\" | \"MOTHER\" | \"GUARDIAN\" | \"OTHER\" (required)",
  "isPrimary": "boolean (optional, default: true)"
}
```

#### Success Response — `201 Created`

```json
{
  "success": true,
  "data": {
    "linkId": "64a1f2b3c4d5e6f7a8b9c0d3",
    "parentId": "64a1f2b3c4d5e6f7a8b9c0d2",
    "learnerId": "64a1f2b3c4d5e6f7a8b9c0d4",
    "relationshipType": "FATHER",
    "isPrimary": true,
    "status": "PENDING",
    "message": "Link request created. Awaiting admin approval."
  }
}
```

#### Error Responses

**400 — Invalid relationship type (VAL_003)**
```json
{
  "success": false,
  "error": {
    "code": "VAL_003",
    "message": "relationshipType must be FATHER, MOTHER, GUARDIAN, or OTHER",
    "severity": "WARNING",
    "category": "VALIDATION"
  }
}
```

**403 — No active link / ABAC guard (PAR_008)**
```
This error occurs on PROTECTED dashboard endpoints when parent tries to access
a child they're not linked to. Not returned from this endpoint.
```

**404 — Learner not found (PAR_010)**
```json
{
  "success": false,
  "error": {
    "code": "PAR_010",
    "message": "Learner not found",
    "severity": "WARNING",
    "category": "NOT_FOUND"
  }
}
```

**409 — Already linked (PAR_009)**
```json
{
  "success": false,
  "error": {
    "code": "PAR_009",
    "message": "Parent already linked to this child",
    "severity": "WARNING",
    "category": "CONFLICT"
  }
}
```

**409 — Link already pending (PAR_011)**
```json
{
  "success": false,
  "error": {
    "code": "PAR_011",
    "message": "Link request already pending review",
    "severity": "WARNING",
    "category": "CONFLICT"
  }
}
```

#### Business Rules

- Parent must be authenticated (JWT token required)
- Learner must exist in database
- Parent can't create duplicate links (either ACTIVE or PENDING)
- `relationshipType` is required enum value
- `isPrimary` defaults to `true` if not provided
- Link starts in `PENDING` status (awaits admin approval in XKT-004)
- Once ACTIVE, parent can access child's dashboard (with ABAC guard in XKT-009+)
- Multiple parents can request the same learner
- One parent can link to multiple learners

#### ABAC Guard (Authorization)

The `ParentLearnerService.assertAccess(parentId, learnerId)` guard is **called first** in all methods that access child data:

```typescript
// Example: Get child dashboard
async getDashboard(parentId, learnerId) {
  // ⭐ FIRST LINE - prevents unauthorized access
  await this.assertAccess(parentId, learnerId);
  
  // ... rest of method ...
}
```

**Guard Logic:**
- Queries `ParentLearnerLink` for `{ parent: parentId, learner: learnerId, status: 'ACTIVE' }`
- If found → access granted ✅
- If not found → throw `ParentError.linkNotFound()` (403 PAR_008) ❌

---

*This document covers XKT-001, XKT-002, and XKT-003. New tickets will add sections below.*
