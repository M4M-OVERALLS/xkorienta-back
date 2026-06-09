# XKORIENTA PARENT MODULE - TECHNICAL DOCUMENTATION

**Version:** 1.0.0  
**Date:** June 8, 2026  
**Status:** LIVE DOCUMENT (Updated continuously)

---

## TABLE OF CONTENTS

1. [System Architecture](#system-architecture)
2. [Database Schema](#database-schema)
3. [Authentication & Authorization](#authentication--authorization)
4. [KYC Verification Flow](#kyc-verification-flow)
5. [ABAC Guard (assertAccess)](#abac-guard-assertaccess)
6. [Error Handling](#error-handling)
7. [Audit Logging](#audit-logging)
8. [Security Considerations](#security-considerations)
9. [Deployment Checklist](#deployment-checklist)

---

## SYSTEM ARCHITECTURE

### Layered Architecture

```
┌─────────────────────────────────────────────────────┐
│                   API Routes                         │
│  (Next.js route handlers: /api/parent/...)          │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│                  Controllers                        │
│  (ParentAuthController, ParentKYCController, etc)  │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│                   Services                          │
│  (ParentAuthService, ParentLearnerService, etc)    │
│  ⭐ Contains assertAccess() ABAC guard              │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│                Repositories                         │
│  (ParentProfileRepository, ParentLearnerRepository) │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│               MongoDB Database                      │
│  (Models: User, ParentProfile, ParentLearnerLink, │
│   AuditLog, etc)                                    │
└─────────────────────────────────────────────────────┘
```

### Request Flow Diagram

```
Client Request
    │
    ▼
Route Handler (route.ts)
    │ Validate JWT token
    ▼
Middleware (withKYCLevel, withParentOwnership)
    │ Check KYC L2 required
    │ Check parent-learner link (ABAC)
    ▼
Controller
    │ Validate input (Zod)
    ▼
Service
    │ 🔐 assertAccess() - CRITICAL ABAC CHECK
    │ Business logic
    ▼
Repository
    │ Database queries
    ▼
AuditLog Repository
    │ Log sensitive actions (immutable)
    ▼
Response
    │ ApiResponse envelope
    ▼
Client
```

---

## DATABASE SCHEMA

### Core Models

**User** (existing, extended)
```typescript
{
  _id: ObjectId,
  name: string,
  email: string (unique),
  phone?: string,
  password: string (bcrypt hashed),
  role: "PARENT" | "TEACHER" | "ADMIN" | ...,
  emailVerified: boolean,
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**ParentProfile** (new)
```typescript
{
  _id: ObjectId,
  user: ObjectId (ref User),         // 1:1 relationship
  kycLevel: 0 | 1 | 2,               // Verification stage
  kycStatus: "PENDING" | "VERIFIED" | "CONFIRMED" | "REJECTED",
  nationalIdType?: "NATIONAL_ID" | "PASSPORT" | "DRIVER_LICENSE",
  nationalIdDocumentUrl?: string,    // S3 URL
  nationalIdVerified: boolean,
  preferredLanguage: "fr" | "en",
  notificationPreferences: {
    sms: boolean,
    email: boolean,
    push: boolean
  },
  isActive: boolean,                 // Can access dashboard
  loginAttempts: number,             // Fail counter
  loginAttemptsFrozenUntil?: Date,  // Account locked until this time
  createdAt: Date,
  updatedAt: Date
}
```

**ParentLearnerLink** (new)
```typescript
{
  _id: ObjectId,
  parent: ObjectId (ref ParentProfile),    // Many:Many
  learner: ObjectId (ref User),            // Many:Many
  relationshipType: "FATHER" | "MOTHER" | "GUARDIAN" | "OTHER",
  isPrimary: boolean,                      // Primary contact for school
  status: "PENDING" | "ACTIVE" | "REVOKED",
  validatedBy?: ObjectId,                  // Admin who approved
  validatedAt?: Date,
  rejectionReason?: string,
  revokedAt?: Date,
  revocationReason?: string,
  lastAccessedAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**AuditLog** (new, immutable)
```typescript
{
  _id: ObjectId,
  requestId: string (unique),          // Trace related ops
  actor: ObjectId (ref User),          // Who did it
  action: "KYC_L1_VERIFIED" | "LINK_APPROVED" | ... (AuditAction enum),
  targetId: ObjectId,                  // Entity affected
  targetType: "ParentProfile" | "ParentLearnerLink" | ...,
  metadata: object,                    // Before/after, reasons, etc
  ipAddress?: string,                  // Client IP
  userAgent?: string,                  // Browser info
  hash: string,                        // SHA256 tamper detection
  isImmutable: boolean = true,         // Prevent updates/deletes
  createdAt: Date                      // No updatedAt (immutable)
}
```

### Database Indexes

**Critical for ABAC Performance:**
```typescript
ParentLearnerLink
  ├─ { parent: 1, learner: 1 } UNIQUE  // Prevent duplicate links
  ├─ { parent: 1, status: 1 }          // Find active children fast
  └─ { learner: 1, status: 1 }         // Find parents for learner

ParentProfile
  ├─ { user: 1 } UNIQUE                // 1:1 relationship
  ├─ { kycLevel: 1, kycStatus: 1 }     // KYC dashboard queries
  └─ { createdAt: -1 }                 // Recent registrations

AuditLog
  ├─ { actor: 1, createdAt: -1 }       // Audit trail by user
  ├─ { targetId: 1, createdAt: -1 }    // Audit trail for entity
  ├─ { action: 1, createdAt: -1 }      // Compliance reports
  └─ { requestId: 1 }                  // Request tracing
```

---

## AUTHENTICATION & AUTHORIZATION

### JWT Token Structure

**Access Token (1 hour expiry)**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "parentProfileId": "507f1f77bcf86cd799439012",
  "email": "jean.moussa@email.cm",
  "role": "PARENT",
  "kycLevel": 2,
  "exp": 1717862400,
  "iss": "xkorienta-parent-module"
}
```

**Refresh Token (7 days expiry)**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "parentProfileId": "507f1f77bcf86cd799439012",
  "exp": 1718467200,
  "iss": "xkorienta-parent-module"
}
```

### Password Security

- **Hashing:** bcrypt with salt=12 rounds
- **Validation:** Min 8 chars (enforced by Zod)
- **Comparison:** bcrypt.compare() (timing-safe)

### Rate Limiting

| Endpoint | Limit | Window | Error Code |
|----------|-------|--------|------------|
| Login | 5 failed attempts | 15 min | PAR_038 |
| SOS Alert | 3 triggers | 24 hours | PAR_019 |
| General API | 100 requests | 1 hour | PAR_039 |

---

## KYC VERIFICATION FLOW

### Two-Level Verification

```
┌─────────────────────────────────┐
│ Level 0: NONE                   │
│ - New registration              │
│ - Can only login                │
└──────────────┬──────────────────┘
               │
               │ Parent uploads ID (POST /kyc/level1)
               ▼
┌─────────────────────────────────┐
│ Level 1: SUBMITTED              │
│ - Waiting for admin review      │
│ - Can request child links       │
│ - CANNOT access dashboard       │
└──────────────┬──────────────────┘
               │
               │ Admin approves (POST /kyc/level1/verify)
               ▼
┌─────────────────────────────────┐
│ Level 1: VERIFIED               │
│ - Document confirmed valid      │
│ - Can request child links       │
│ - CANNOT access dashboard       │
└──────────────┬──────────────────┘
               │
               │ School confirms relationship (POST /kyc/level2/validate)
               ▼
┌─────────────────────────────────┐
│ Level 2: CONFIRMED              │
│ - Relationship verified         │
│ - CAN access dashboard ✅       │
│ - Can view all child data       │
└─────────────────────────────────┘
```

### KYC Middleware

**All dashboard endpoints require KYC L2:**
```typescript
// Protected endpoint example
export const GET = withKYCLevel(2)(async (req, parentId) => {
  // Inside here, parent is GUARANTEED to have KYC L2
  // withKYCLevel middleware enforced it before reaching this code
});
```

---

## ABAC GUARD (assertAccess)

### The Critical Line of Code

**Location:** `ParentLearnerService.assertAccess()`

**Purpose:** Prevent unauthorized parent-child data access

**Must be called as FIRST LINE of every dashboard method:**

```typescript
async getDashboard(parentId, learnerId) {
  // ⭐ FIRST LINE - ALWAYS
  await this.assertAccess(parentId, learnerId);
  
  // If we get here, parent IS linked to this learner
  // Safe to fetch dashboard data
}
```

### How It Works

```
GET /parent/children/{learnerId}/dashboard

Query: SELECT * FROM parent_learner_links
       WHERE parent = :parentId 
         AND learner = :learnerId 
         AND status = 'ACTIVE'

Result?
  ├─ YES → Access granted, continue
  └─ NO  → Throw ParentError.linkNotFound() (403 Forbidden)
```

### Attack Prevention

**Without assertAccess:**
```
Parent A (ID: 111) requests:
GET /parent/children/999/dashboard

If no guard, queries learner 999 data
Even though Parent A is NOT linked to learner 999!

Data leak! ❌
```

**With assertAccess:**
```
Parent A (ID: 111) requests:
GET /parent/children/999/dashboard

assertAccess(111, 999) called
No link found → throws error
403 Forbidden ✅

Parent A only sees:
Error: "Parent-child link not found"
```

### Audit Trail

Every access attempt is logged:
```json
{
  "action": "DASHBOARD_ACCESSED",
  "actor": "parent_111",
  "targetId": "learner_999",
  "metadata": {
    "accessGranted": true,
    "learnerId": "999",
    "timestamp": "2026-06-08T10:30:00Z"
  },
  "hash": "abc123..." // Tamper detection
}
```

---

## ERROR HANDLING

### Error Pattern (All Endpoints)

```typescript
try {
  const result = await service.doSomething(data);
  return ApiResponse.ok(result);
} catch (error) {
  if (error instanceof ParentError) {
    // Map to error catalog (PAR_001-PAR_050)
    return ApiResponse.error({
      code: error.code,
      message: error.message,
      httpStatus: error.httpStatus,
      severity: error.severity,
      category: error.category
    });
  }
  // Unexpected error
  return ApiResponse.internalError();
}
```

### Error Code Organization

**PAR_001-PAR_007:** Core (existing)  
**PAR_008-PAR_011:** ABAC & Linking  
**PAR_012-PAR_018:** KYC Verification  
**PAR_019-PAR_021:** Alerts & SOS  
**PAR_022-PAR_024:** Notifications  
**PAR_025-PAR_028:** Admin Operations  
**PAR_029-PAR_031:** Audit & Compliance  
**PAR_032-PAR_034:** Database  
**PAR_035-PAR_037:** File Upload  
**PAR_038-PAR_039:** Rate Limiting  
**PAR_040-PAR_042:** Configuration  
**PAR_043-PAR_050:** Reserved for Future  

---

## AUDIT LOGGING

### Immutable Audit Trail

**Prevents tampering:**
```typescript
// Prevents updates
auditLogSchema.pre('findByIdAndUpdate', function () {
  throw new Error('Audit logs are immutable');
});

// Prevents deletion
auditLogSchema.pre('deleteOne', function () {
  throw new Error('Audit logs cannot be deleted (7-year retention)');
});
```

### Hash-Based Integrity Verification

```typescript
const hashInput = `${actor}${action}${targetId}${timestamp}`;
const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

// Later: Verify integrity
const expectedHash = crypto
  .createHash('sha256')
  .update(originalInput)
  .digest('hex');

if (storedHash !== expectedHash) {
  throw new Error('Audit log compromised - tampering detected!');
}
```

### What Gets Logged

✅ All KYC events (L1 submitted, L1 verified, L2 confirmed)  
✅ All link events (created, approved, revoked)  
✅ All SOS alerts (triggered, acknowledged)  
✅ All admin actions (KYC approvals, link validations)  
✅ Dashboard access (for audit trail)  

❌ Normal reads (dashboard views, list children) - optional logging only

---

## SECURITY CONSIDERATIONS

### Password Security

- Bcrypt with 12 rounds (timing-safe comparison)
- Min 8 characters (enforced)
- Rate limited login (5 attempts / 15 min)
- Account lockout (15 minutes after 5 failures)

### JWT Security

- Secret from `NEXTAUTH_SECRET` environment variable
- 1 hour access token expiry (short-lived)
- 7 day refresh token expiry (long-lived)
- No sensitive data in token payload
- Signature verification on every request

### ABAC Implementation

- assertAccess() checks parent-learner link status
- Called FIRST in every service method
- Returns 403 Forbidden if no active link
- Logs all access attempts (success & failure)

### Data Protection

- No passwords in responses
- No sensitive data in audit logs
- File uploads stored in S3/MinIO (separate from DB)
- GDPR-compliant data export capability
- 7-year audit log retention

### SQL/NoSQL Injection Prevention

- Mongoose (ODM) prevents injection
- Input validation with Zod (type-safe)
- No string interpolation in queries

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment

- [ ] All environment variables set (.env.production)
- [ ] Database backups configured
- [ ] MongoDB indices created
- [ ] S3/MinIO credentials valid
- [ ] SMS/Email services tested
- [ ] JWT secrets rotated

### Post-Deployment

- [ ] Health check endpoint working
- [ ] Auth flow tested (register → login → KYC → dashboard)
- [ ] ABAC guard verified (parent can't access other parent's child)
- [ ] Audit logs being written
- [ ] Error codes mapped correctly
- [ ] Rate limiting active

### Monitoring

- [ ] Failed login attempts dashboard
- [ ] KYC submission queue visibility
- [ ] Pending link approvals dashboard
- [ ] Audit log integrity checks (daily)
- [ ] Database query performance
- [ ] External service status (SMS, Email, S3)

---

## SUPPORT & MAINTENANCE

**Emergency Contact:** security@xkorienta.cm  
**Architecture Review:** Quarterly  
**Audit Log Retention:** 7 years (GDPR compliance)  
**Password Rotation:** Every 90 days (admin accounts)

---

**Last Updated:** June 8, 2026  
**Next Review:** June 30, 2026  
**Status:** ✅ Active
