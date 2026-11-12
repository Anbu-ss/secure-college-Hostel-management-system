# Secure College Hostel Management System — API Documentation

All API endpoints are prefixed with `/api`.

---

## 1. Authentication Endpoints (`/api/auth`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register a student or staff/HOD account with department validation |
| POST | `/api/auth/login` | Public | Login via Email & Password (returns JWT & User object) |
| POST | `/api/auth/google-login` | Public | Login via Google ID token (verifies token, provisions user if new) |
| POST | `/api/auth/admin-login` | Public | Login for Admin/Staff via Firebase ID token |
| POST | `/api/auth/create-admin` | Admin, Warden | Create administrative user in Firebase and SQLite |
| POST | `/api/auth/bulk-student-upload` | Admin, Staff | Batch upload student records from spreadsheet |
| POST | `/api/auth/verify-student-identity` | Public | Step 1 of password reset: verify email + registerNumber |
| POST | `/api/auth/reset-student-password` | Public | Step 2 of password reset: set new bcrypt-hashed password |

---

## 2. Gate Pass Requests Endpoints (`/api/requests`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/requests/apply` | Student | Submit a new gate pass request (Local or Home) |
| GET | `/api/requests/my-requests` | Student | Fetch all submitted requests for logged-in student |
| GET | `/api/requests/my-profile` | Student | Retrieve student room, block, department, and user data |
| GET | `/api/requests/staff/pending` | Staff | Fetch pending Home pass requests for tutor's department |
| PUT | `/api/requests/staff/approve/:id` | Staff | Approve (`StaffApproved`) or Reject request with reason |
| GET | `/api/requests/hod/pending` | HOD | Fetch staff-approved Home pass requests for HOD's department |
| PUT | `/api/requests/hod/approve/:id` | HOD | Approve (`HODApproved`) or Reject request with reason |
| GET | `/api/requests/warden/pending` | Warden, Admin | Fetch Local pending requests and Home HODApproved requests |
| PUT | `/api/requests/warden/approve/:id` | Warden, Admin | Final approval (`WardenApproved`) and generate signed QR code |
| GET | `/api/requests/admin/holiday-windows` | Admin, Warden | List all holiday windows |
| POST | `/api/requests/admin/holiday-windows` | Admin, Warden | Create a new holiday window |
| DELETE | `/api/requests/admin/holiday-windows/:id` | Admin, Warden | Toggle active state of a holiday window |
| POST | `/api/requests/admin/holiday-windows/:id/apply-bulk` | Admin, Warden | Auto-promote matching pending requests under holiday mode |

---

## 3. Gate Pass Endpoints (`/api/gatepass`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| PUT | `/api/gatepass/hod/approve/:id` | HOD | HOD approval and pass generation |
| GET | `/api/gatepass/verify/:qrHash` | Security, Admin | Retrieve pass details by QR code hash |
| GET | `/api/gatepass/all` | Warden, Admin, Staff, HOD | View all issued gate passes |
| GET | `/api/gatepass/my-passes` | Student | View own active and past gate passes |

---

## 4. Security & Audit Endpoints (`/api/security` & `/api/notifications`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/security/scan` | Security, Admin, Warden | Record student Exit or Entry scan with validation |
| GET | `/api/security/verify/:qrHash` | Security, Admin, Warden | Inspect pass status, expiration, and student details |
| GET | `/api/security/logs` | Security, Admin, Warden, HOD | Audit trail with date range and pass type filtering |
| GET | `/api/security/occupancy` | Warden, Admin | Real-time on-campus vs off-campus student occupancy |
| GET | `/api/notifications` | Authenticated | Fetch up to 30 latest notifications |
| PUT | `/api/notifications/read` | Authenticated | Mark all notifications as read |

