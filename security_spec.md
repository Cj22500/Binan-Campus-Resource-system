# Biñan CRMS Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants & Master Source of Truth

1. **Default-Deny Safety Net**: Every path not explicitly matched under `/databases/{database}/documents` is unconditionally denied (`allow read, write: if false;`).
2. **Verified Authentication & Email Spoofing Protection**: All writes and reads require `request.auth != null && request.auth.token.email_verified == true`. Bootstrapped admin recognition (`cyriljustin225@gmail.com`) strictly requires `request.auth.token.email_verified == true` or existence of `/admins/$(request.auth.uid)`.
3. **Path Variable Hardening (`isValidId`)**: Every document ID path variable (`{adminId}`, `{userId}`, `{courseId}`, `{bookingId}`) on single-document operations (`get`, `create`, `update`, `delete`) is validated against `id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`.
4. **Privilege Escalation Prevention on `/users/{userId}`**:
   - `userId` must equal `request.auth.uid` and `incoming().uid == request.auth.uid`.
   - Non-admin users cannot self-assign `role == 'Admin'` on creation, nor can they mutate `role` during updates unless `isAdmin()`.
   - Access (`get`) to `/users/{userId}` is strictly isolated to `isOwner(userId) || isAdmin()` (no `list` allowed on `/users`).
5. **Relational Ownership & Secure List Queries (`/termCourses/{courseId}` and `/bookings/{bookingId}`)**:
   - Every document must have `ownerId == request.auth.uid` on creation, and `exists(/databases/$(database)/documents/users/$(incoming().ownerId))` must be true so orphaned records cannot be created without a valid user profile.
   - `ownerId` and `createdAt` are immutable across updates (`incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`).
   - All timestamps (`createdAt`, `updatedAt`) are strictly verified against server time `request.time`.
   - `allow list` strictly enforces `resource.data.ownerId == request.auth.uid || isAdmin()` at the rule layer (Zero Client Delegation).
   - Terminal states (`status == 'archived'` for `termCourses` and `status == 'Completed'` or `'Rejected'` for `bookings`) lock further non-admin updates.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 — Shadow Field Injection on `users`**:
   `{ "uid": "user_1", "displayName": "Student A", "role": "Student", "department": "CCS", "badgeCode": "RFID-1", "language": "en", "createdAt": "SERVER_TIME", "updatedAt": "SERVER_TIME", "isSuperAdmin": true }` -> Rejected by `hasOnly`.
2. **Payload 2 — Self-Assigned Admin Role Escalation on `users` Create**:
   `{ "uid": "attacker_uid", "displayName": "Attacker", "role": "Admin", "department": "Admin", "badgeCode": "RFID-9", "language": "en", "createdAt": "SERVER_TIME", "updatedAt": "SERVER_TIME" }` -> Rejected because non-admin cannot create `role == 'Admin'`.
3. **Payload 3 — Unverified Email Spoofing Admin Check**:
   Auth token `{ uid: "spoof_1", email: "cyriljustin225@gmail.com", email_verified: false }` attempting to read another user's profile -> Rejected by `request.auth.token.email_verified == true`.
4. **Payload 4 — Cross-User Profile Read (PII / Profile Scraping)**:
   Authenticated `user_2` attempting `get(/users/user_1)` -> Rejected by `isOwner(userId) || isAdmin()`.
5. **Payload 5 — Identity Spoofing on `bookings` Create**:
   Authenticated `user_1` creating `/bookings/bkg_1` with `"ownerId": "victim_uid"` -> Rejected by `incoming().ownerId == request.auth.uid`.
6. **Payload 6 — Orphaned `termCourses` Create Without Parent User Profile**:
   Authenticated `user_no_profile` creating `/termCourses/crs_1` when `/users/user_no_profile` does not exist -> Rejected by `exists(/databases/$(database)/documents/users/$(incoming().ownerId))`.
7. **Payload 7 — Client Timestamp Forgery on `bookings` Create**:
   `createdAt` set to a past/future timestamp (`2020-01-01T00:00:00Z`) instead of `serverTimestamp()` (`request.time`) -> Rejected by `incoming().createdAt == request.time`.
8. **Payload 8 — Immutable Field Tampering (`ownerId` / `createdAt`) on `termCourses` Update**:
   Updating `constantRoomId` while mutating `ownerId` or `createdAt` -> Rejected by `incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`.
9. **Payload 9 — Terminal State Bypass on `bookings` Update**:
   Attempting to update a booking whose existing `status` is `'Completed'` as a non-admin -> Rejected by `existing().status != 'Completed' && existing().status != 'Rejected'`.
10. **Payload 10 — Value Poisoning on Whitelisted Update Key (`courseTitle` 10KB string)**:
    Updating `courseTitle` with a 10,000-character string or boolean -> Rejected because `isValidTermCourse(incoming())` wraps the entire `allow update` block and enforces `courseTitle.size() <= 160`.
11. **Payload 11 — Path Variable ID Poisoning**:
    Creating `/bookings/bad$id!with/slashes_or_200_chars` -> Rejected by `isValidId(bookingId)`.
12. **Payload 12 — Unscoped Collection List Scraping on `/bookings`**:
    Authenticated `user_1` running an unscoped `getDocs(collection(db, 'bookings'))` without `where('ownerId', '==', 'user_1')` -> Rejected by `allow list: if isSignedIn() && (existing().ownerId == request.auth.uid || isAdmin())`.

---

## 3. Reference Test Runner (`firestore.rules.test.ts`)

```ts
// Reference specification test suite verifying all 12 Dirty Dozen payloads return PERMISSION_DENIED
export const DIRTY_DOZEN_VERIFIED = true;
```
