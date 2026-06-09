# XKORIENTA PARENT MODULE - API DOCUMENTATION

**Version:** 1.0.0  
**Last Updated:** June 8, 2026  
**Base URL:** `https://api.xkorienta.cm/api` (production)  
**Environments:** Development, Staging, Production  

---

## TABLE OF CONTENTS

1. [Authentication](#authentication)
2. [Authentication Endpoints](#authentication-endpoints)
3. [Child Linking Endpoints](#child-linking-endpoints)
4. [KYC Verification Endpoints](#kyc-verification-endpoints)
5. [Dashboard Endpoints](#dashboard-endpoints)
6. [Admin Endpoints](#admin-endpoints)
7. [Error Codes](#error-codes)
8. [Examples](#examples)

---

## AUTHENTICATION

All endpoints (except registration) require JWT authentication in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

### Token Structure

Access tokens contain:
- `userId`: User ID
- `parentProfileId`: Parent Profile ID
- `email`: Email address
- `role`: Always `PARENT`
- `kycLevel`: Current KYC level (0, 1, or 2)
- `exp`: Expiration (1 hour)

Example:
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "parentProfileId": "507f1f77bcf86cd799439012",
  "email": "jean.moussa@email.cm",
  "role": "PARENT",
  "kycLevel": 2,
  "exp": 1717862400
}
```

---

## AUTHENTICATION ENDPOINTS

### POST /parent/auth/register
**XKT-001** | Register a new parent account using invitation token

**Request:**
```bash
curl -X POST https://api.xkorienta.cm/api/parent/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "invitationToken": "a1b2c3d4e5f6...a1b2c3d4e5f6",
    "name": "Jean-Paul Moussa",
    "email": "jean.moussa@email.cm",
    "phone": "+237691234567",
    "password": "SecurePass123!",
    "language": "fr"
  }'
```

**Success Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439015",
    "parentProfileId": "507f1f77bcf86cd799439016",
    "email": "jean.moussa@email.cm"
  }
}
```

**Error Response:** `409 Conflict`
```json
{
  "success": false,
  "error": {
    "code": "PAR_004",
    "message": "Email already registered",
    "severity": "WARNING",
    "category": "CONFLICT"
  }
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| invitationToken | string | ✓ | School invitation code (32+ chars) |
| name | string | ✓ | Full name (2-100 chars) |
| email | string | ✓ | Valid email address |
| phone | string | | Phone number |
| password | string | ✓ | Min 8 characters |
| language | string | | `fr` or `en` (default: `fr`) |

**Error Codes:**
- `PAR_005`: Invalid or expired invitation token
- `PAR_004`: Email already registered
- `PAR_006`: Validation error
- `PAR_007`: Internal server error

---

### POST /parent/auth/login
**XKT-002** | Login parent and receive JWT tokens

**Request:**
```bash
curl -X POST https://api.xkorienta.cm/api/parent/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jean.moussa@email.cm",
    "password": "SecurePass123!",
    "rememberMe": false
  }'
```

**Success Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439015",
    "parentProfileId": "507f1f77bcf86cd799439016",
    "email": "jean.moussa@email.cm",
    "name": "Jean-Paul Moussa",
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 3600,
    "kycLevel": 0
  }
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | ✓ | Parent email address |
| password | string | ✓ | Account password |
| rememberMe | boolean | | Keep session active longer |

**Error Codes:**
- `PAR_002`: Invalid email or password
- `PAR_003`: Account is disabled
- `PAR_038`: Account locked (15 failed attempts)

---

## CHILD LINKING ENDPOINTS

### POST /parent/children/{learnerId}/link
**XKT-003** | Request to link to a child

**Request:**
```bash
curl -X POST https://api.xkorienta.cm/api/parent/children/507f1f77bcf86cd799439012/link \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "relationshipType": "FATHER",
    "isPrimary": true
  }'
```

**Success Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "linkId": "507f1f77bcf86cd799439018",
    "status": "PENDING",
    "message": "Link request created. Awaiting admin approval."
  }
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| relationshipType | string | ✓ | `FATHER`, `MOTHER`, `GUARDIAN`, `OTHER` |
| isPrimary | boolean | | Is primary contact (default: `true`) |

**Error Codes:**
- `PAR_008`: Parent-child link not found or inactive
- `PAR_009`: Already linked to this child
- `PAR_010`: Learner not found

---

### POST /parent/children/{linkId}/validate
**XKT-004** | Admin approves pending link

**Admin Only** | Requires admin token

**Request:**
```bash
curl -X POST https://api.xkorienta.cm/api/parent/children/507f1f77bcf86cd799439018/validate \
  -H "Authorization: Bearer <adminToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "approve": true,
    "reason": ""
  }'
```

**Success Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "parentId": "507f1f77bcf86cd799439015",
    "learnerId": "507f1f77bcf86cd799439012",
    "status": "ACTIVE",
    "message": "Link approved. Parent can now access child dashboard (after KYC L2)."
  }
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| approve | boolean | ✓ | `true` to approve, `false` to reject |
| reason | string | | Reason for rejection (if `approve=false`) |

---

### GET /parent/children
**XKT-005** | List all active children for parent

**Request:**
```bash
curl -X GET https://api.xkorienta.cm/api/parent/children \
  -H "Authorization: Bearer <accessToken>"
```

**Success Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "linkId": "507f1f77bcf86cd799439018",
      "learnerId": "507f1f77bcf86cd799439012",
      "name": "Kamga Jean-Claude",
      "relationshipType": "FATHER",
      "isPrimary": true
    },
    {
      "linkId": "507f1f77bcf86cd799439019",
      "learnerId": "507f1f77bcf86cd799439013",
      "name": "Moussa Patricia",
      "relationshipType": "MOTHER",
      "isPrimary": false
    }
  ],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 100
  }
}
```

---

## KYC VERIFICATION ENDPOINTS

### POST /parent/kyc/level1
**XKT-006** | Submit identity document for KYC Level 1

**Request:**
```bash
curl -X POST https://api.xkorienta.cm/api/parent/kyc/level1 \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "documentType": "NATIONAL_ID",
    "fileName": "national_id.jpg",
    "fileSize": 2048576,
    "fileMimeType": "image/jpeg",
    "fileBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAY..."
  }'
```

**Success Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "kycLevel": 1,
    "kycStatus": "SUBMITTED",
    "message": "Document submitted successfully. Admin will review within 24-48 hours.",
    "nextSteps": [
      "Admin will review your document within 24-48 hours",
      "You will receive an email when verification is complete",
      "Once approved, school will confirm your relationship to the child"
    ]
  }
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| documentType | string | ✓ | `NATIONAL_ID`, `PASSPORT`, `DRIVER_LICENSE` |
| fileName | string | ✓ | Original file name |
| fileSize | number | ✓ | Size in bytes (max 5MB) |
| fileMimeType | string | ✓ | `image/jpeg`, `image/png`, `application/pdf` |
| fileBase64 | string | ✓ | Base64 encoded file content |

**Error Codes:**
- `PAR_015`: Invalid file format or size
- `PAR_037`: File too large (>5MB)
- `PAR_035`: File upload failed

---

### POST /parent/kyc/level2/validate
**XKT-008** | School admin confirms KYC Level 2

**Admin Only** | Grants full dashboard access

**Request:**
```bash
curl -X POST https://api.xkorienta.cm/api/parent/kyc/level2/validate \
  -H "Authorization: Bearer <adminToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "parentId": "507f1f77bcf86cd799439016",
    "relationshipNotes": "Phone verification completed. Confirmed father of student."
  }'
```

**Success Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "kycLevel": 2,
    "kycStatus": "CONFIRMED",
    "dashboardAccessGranted": true,
    "message": "✅ KYC Level 2 confirmed! Parent now has full dashboard access.",
    "nextSteps": [
      "Parent can now login and view child dashboard",
      "Parent can request child links",
      "Parent will receive exam results, attendance updates, and alerts"
    ]
  }
}
```

---

### GET /parent/kyc/status
**XKT-008** | Check parent's KYC verification status

**Request:**
```bash
curl -X GET https://api.xkorienta.cm/api/parent/kyc/status \
  -H "Authorization: Bearer <accessToken>"
```

**Success Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "kycLevel": 1,
    "kycStatus": "VERIFIED",
    "canAccessDashboard": false,
    "canRequestChildLink": true,
    "nextSteps": [
      "School will confirm your identity (24 hours)",
      "Then you'll have full dashboard access"
    ],
    "progress": {
      "step": "Step 2 of 3",
      "percentage": 66
    },
    "timeline": {
      "step1": {
        "name": "Upload Identity Document",
        "status": "Completed",
        "estimatedTime": "5 minutes to upload"
      },
      "step2": {
        "name": "Admin Reviews Document",
        "status": "In Progress",
        "estimatedTime": "24-48 hours"
      },
      "step3": {
        "name": "School Confirms Relationship",
        "status": "Pending",
        "estimatedTime": "24 hours after step 2"
      }
    }
  }
}
```

---

## DASHBOARD ENDPOINTS

### GET /parent/children/{learnerId}/dashboard
**XKT-009** | Get synthetic dashboard overview

**Protected:** Requires KYC Level 2

**Request:**
```bash
curl -X GET https://api.xkorienta.cm/api/parent/children/507f1f77bcf86cd799439012/dashboard \
  -H "Authorization: Bearer <accessToken>"
```

**Success Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "learner": {
      "id": "507f1f77bcf86cd799439012",
      "name": "Kamga Jean-Claude",
      "class": "Form 4A",
      "school": "Lycée de Yaoundé"
    },
    "performance": {
      "averageScore": 78.5,
      "trend": "improving",
      "subjects": 12
    },
    "attendance": {
      "presentCount": 45,
      "absentCount": 2,
      "lateCount": 3,
      "attendanceRate": 93
    },
    "alerts": {
      "warnings": 1,
      "sosAlerts": 0
    },
    "recentActivity": {
      "lastUpdated": "2026-06-08T10:30:00Z",
      "examAttempts": 5,
      "documentsSubmitted": 3
    }
  }
}
```

---

## ADMIN ENDPOINTS

### POST /parent/admin/invitations
**Admin Only** | Create parent invitation token

**Request:**
```bash
curl -X POST https://api.xkorienta.cm/api/parent/admin/invitations \
  -H "Authorization: Bearer <adminToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "learnerId": "507f1f77bcf86cd799439012",
    "expiresInDays": 30,
    "maxUses": 1
  }'
```

**Success Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "invitationToken": "a1b2c3d4e5f6...a1b2c3d4e5f6",
    "expiresAt": "2026-07-08T10:30:00Z",
    "createdBy": "507f1f77bcf86cd799439020",
    "message": "Invitation created. Share this token with the parent to register.",
    "instructions": [
      "Share the invitationToken with the parent",
      "Parent visits: https://xkorienta.cm/register",
      "Parent enters token and creates account"
    ]
  }
}
```

---

## ERROR CODES

See [Extended Error Catalog](./01_EXTENDED_ERROR_CATALOG.json) for complete list.

### Common Errors

| Code | HTTP | Message |
|------|------|---------|
| `PAR_001` | 404 | Parent account not found |
| `PAR_002` | 401 | Invalid email or password |
| `PAR_003` | 403 | Account is disabled |
| `PAR_004` | 409 | Email already registered |
| `PAR_005` | 400 | Invalid or expired invitation token |
| `PAR_008` | 403 | Parent-child link not found or inactive |
| `PAR_009` | 409 | Parent already linked to this child |
| `PAR_012` | 403 | Insufficient KYC level for this action |
| `PAR_019` | 429 | SOS alert rate limit exceeded |
| `PAR_038` | 429 | Account locked - too many failed attempts |

---

## EXAMPLES

### Complete Auth Flow Example

**1. Create Invitation (Admin)**
```bash
POST /parent/admin/invitations
→ invitationToken: "abc123..."
```

**2. Register Parent**
```bash
POST /parent/auth/register
{
  "invitationToken": "abc123...",
  "name": "Jean-Paul",
  "email": "jean@email.cm",
  "password": "Pass123!"
}
→ userId, parentProfileId
```

**3. Login**
```bash
POST /parent/auth/login
{
  "email": "jean@email.cm",
  "password": "Pass123!"
}
→ accessToken (JWT)
```

**4. Upload KYC**
```bash
POST /parent/kyc/level1
{
  "documentType": "NATIONAL_ID",
  "fileBase64": "..."
}
→ kycStatus: "SUBMITTED"
```

**5. Admin Verifies KYC L1**
```bash
POST /parent/kyc/level1/verify
{
  "parentId": "...",
  "approve": true
}
→ kycLevel: 1
```

**6. Admin Confirms KYC L2**
```bash
POST /parent/kyc/level2/validate
{
  "parentId": "...",
  "relationshipNotes": "..."
}
→ kycLevel: 2, dashboardAccessGranted: true
```

**7. Access Dashboard**
```bash
GET /parent/children/{learnerId}/dashboard
→ Dashboard data
```

---

## RATE LIMITS

| Endpoint | Limit | Window |
|----------|-------|--------|
| Login | 5 attempts | 15 minutes |
| SOS Alert | 3 triggers | 24 hours |
| API (general) | 100 requests | 1 hour |

---

## Support

- **Email:** support@xkorienta.cm
- **Phone:** +237 (2) XXXX XXXX
- **Slack:** #parent-module-api

---

**Last Updated:** June 8, 2026  
**Version:** 1.0.0  
**Status:** ✅ Active
