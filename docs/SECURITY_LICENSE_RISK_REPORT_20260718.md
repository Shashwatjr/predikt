# PREDIKT Security, Dependency, and Open Source License Risk Report

Date: 2026-07-18
Scope: `backend/`, `mobile/`, root config, Docker Compose, npm production dependencies
Method: manual code review, configuration review, secret exposure scan, `npm audit`, `license-checker`, targeted test execution

## Executive Summary

Overall consolidated risk score: **6.4 / 10 (Moderate-High)**

Why:

- No critical remote code execution or obvious authorization bypass was found in the reviewed application code.
- Baseline controls are present: DTO validation, bcrypt password hashing, JWT expiry, refresh-token rotation, Helmet, CORS allow-listing, and route throttling.
- The highest current risks are operational and credential-related:
  - committed local secrets and default credentials in tracked `.env` files
  - hardcoded pilot/demo credentials in source and seed scripts
  - known vulnerable transitive backend dependency (`multer`)
  - browser token storage for user and admin sessions, which increases XSS blast radius

## Security Findings

### 1. High: tracked secrets and default credentials are present in repository files

Evidence:

- [`.env`](/Users/krivikshaaitech/predikt/.env:3) contains `POSTGRES_PASSWORD=change_me_in_production`
- [`.env`](/Users/krivikshaaitech/predikt/.env:8) contains `PGADMIN_DEFAULT_PASSWORD=pgadmin_secret`
- [`.env`](/Users/krivikshaaitech/predikt/.env:18) contains `JWT_SECRET=super_secret_jwt_key_change_in_production`
- [`backend/.env`](/Users/krivikshaaitech/predikt/backend/.env:2) contains `JWT_SECRET="super_secret_jwt_key_change_in_production"`
- [`backend/.env`](/Users/krivikshaaitech/predikt/backend/.env:3) contains `ADMIN_JWT_SECRET="change_this_admin_secret_for_local_dev"`

Risk:

- If this repository is shared broadly, copied into CI, or accidentally published, these values become immediately reusable for local/staging compromise.
- Teams often reuse "temporary" development secrets in preview environments; that turns a local hygiene issue into an environment compromise.

Impact:

- JWT forgery in misconfigured non-production environments
- unauthorized DB and pgAdmin access where these values are reused
- poor secret hygiene and audit/compliance failure risk

Recommendation:

- Remove tracked `.env` files from version control and rotate every exposed credential.
- Keep only `.env.example` and production example templates in git.
- Enforce secret scanning in CI and pre-commit.

### 2. High: hardcoded pilot/demo account credentials are embedded in the client and seed scripts

Evidence:

- [`mobile/src/screens/LoginScreen.tsx`](/Users/krivikshaaitech/predikt/mobile/src/screens/LoginScreen.tsx:15) defines prefilled credentials including `pilot@predikt.ai / PilotMvp2026!` and `test@predikt.ai / Password123!`
- [`backend/scripts/seed-pilot-user.ts`](/Users/krivikshaaitech/predikt/backend/scripts/seed-pilot-user.ts:6) hardcodes the pilot account password and prints it to stdout at [line 65](/Users/krivikshaaitech/predikt/backend/scripts/seed-pilot-user.ts:65)

Risk:

- If a pilot/demo environment is internet reachable and seeded with these accounts, compromise is trivial.
- Credentials in client code are recoverable from bundles even if hidden behind `__DEV__` during most builds.

Impact:

- unauthorized account access
- test/pilot environment takeover
- reputational damage if reused in demos or customer previews

Recommendation:

- Remove hardcoded credentials from source.
- Gate test logins behind local-only environment variables or non-production feature flags.
- Generate one-time seeded passwords at provisioning time instead of committing them.

### 3. High: backend has a known vulnerable transitive dependency (`multer`) via Nest platform-express

Evidence:

- `npm audit` reports `multer` DoS advisories `GHSA-72gw-mp4g-v24j` and `GHSA-3p4h-7m6x-2hcm`
- [`backend/package-lock.json`](/Users/krivikshaaitech/predikt/backend/package-lock.json:2413) resolves `multer` to `2.1.1`
- [`backend/package-lock.json`](/Users/krivikshaaitech/predikt/backend/package-lock.json:2374) includes `@nestjs/platform-express`

Risk:

- Even if the app does not currently expose upload endpoints, vulnerable packages expand attack surface and future regressions.
- If multipart handling is added later without upgrading, the issue becomes directly exploitable.

Impact:

- denial of service via malformed multipart input

Recommendation:

- Upgrade to a Nest / `@nestjs/platform-express` version that pulls a fixed `multer`.
- Add `npm audit` enforcement for production dependencies in CI.

### 4. Medium: browser session tokens are stored in web-accessible storage

Evidence:

- User web sessions are persisted through AsyncStorage on web in [`mobile/src/services/authStorage.ts`](/Users/krivikshaaitech/predikt/mobile/src/services/authStorage.ts:154) and loaded from web storage at [line 145](/Users/krivikshaaitech/predikt/mobile/src/services/authStorage.ts:145)
- Admin web sessions are stored in `window.sessionStorage` in [`mobile/src/admin/context/AdminAuthContext.tsx`](/Users/krivikshaaitech/predikt/mobile/src/admin/context/AdminAuthContext.tsx:117) and restored from there at [line 41](/Users/krivikshaaitech/predikt/mobile/src/admin/context/AdminAuthContext.tsx:41)

Risk:

- Any XSS in the web app or an included dependency can extract bearer tokens and fully impersonate the session.
- This is especially sensitive for the admin portal because the admin token grants privileged data access.

Impact:

- full user or admin account takeover if XSS occurs

Recommendation:

- For web, prefer server-managed `HttpOnly`, `Secure`, `SameSite` cookies where architecture allows.
- If bearer storage must remain client-side, tighten CSP, audit any HTML injection paths, shorten TTLs further, and add token binding/reauthentication for admin actions.

### 5. Medium: weak application password policy for normal user accounts

Evidence:

- [`backend/src/auth/dto/register.dto.ts`](/Users/krivikshaaitech/predikt/backend/src/auth/dto/register.dto.ts:11) only requires `@MinLength(8)`
- [`backend/src/auth/dto/guest-upgrade.dto.ts`](/Users/krivikshaaitech/predikt/backend/src/auth/dto/guest-upgrade.dto.ts:12) also only requires `@MinLength(8)`

Risk:

- This allows low-entropy passwords such as dictionary words plus digits.
- The risk is partially reduced by throttling on login and bcrypt hashing, but weak passwords remain a common account-compromise path.

Impact:

- elevated credential stuffing and brute-force success probability

Recommendation:

- Enforce stronger password rules or use a breached-password check.
- Add optional MFA for admin and high-value creator accounts.

### 6. Medium: mobile app defaults to unsecured HTTP for local API access

Evidence:

- [`mobile/src/services/api.ts`](/Users/krivikshaaitech/predikt/mobile/src/services/api.ts:9) falls back to `http://10.0.2.2:3000` or `http://localhost:3000`

Risk:

- This is acceptable for local development, but risky if copied into shared preview or device-on-LAN testing without TLS.
- Tokens and credentials can be intercepted on an untrusted network.

Impact:

- credential and token disclosure in insecure test setups

Recommendation:

- Keep HTTP local-only and document that preview/staging/mobile-device testing must use HTTPS.
- Fail closed for non-local hosts that are not HTTPS.

## Positive Controls Observed

- Global DTO validation with whitelist/forbid settings in [`backend/src/app.bootstrap.ts`](/Users/krivikshaaitech/predikt/backend/src/app.bootstrap.ts:70)
- Helmet enabled in [`backend/src/app.bootstrap.ts`](/Users/krivikshaaitech/predikt/backend/src/app.bootstrap.ts:26)
- Explicit CORS origin filtering in [`backend/src/app.bootstrap.ts`](/Users/krivikshaaitech/predikt/backend/src/app.bootstrap.ts:33)
- Login, refresh, and guest endpoints are throttled in [`backend/src/auth/auth.controller.ts`](/Users/krivikshaaitech/predikt/backend/src/auth/auth.controller.ts:18)
- Refresh tokens are hashed and rotated in [`backend/src/auth/auth.service.ts`](/Users/krivikshaaitech/predikt/backend/src/auth/auth.service.ts:303)
- Admin authorization is separated from user JWT auth in [`backend/src/admin/admin-auth.guard.ts`](/Users/krivikshaaitech/predikt/backend/src/admin/admin-auth.guard.ts:17)

## Dependency Vulnerability Summary

### Backend

- `npm audit` result: **2 high** vulnerabilities
- Affected package chain: `@nestjs/platform-express` -> `multer@2.1.1`
- Primary risk type: denial of service

### Mobile

- `npm audit` result: **10 moderate** vulnerabilities
- Most findings are in Expo-related tooling/transitives (`@expo/cli`, `@expo/config`, `@expo/config-plugins`, `uuid`, `xcode`)
- Current evidence suggests these are primarily build/dev ecosystem issues rather than direct runtime app compromise

### Dependency Risk Assessment

- Backend dependency risk: **Moderate**
- Mobile dependency risk: **Low-Moderate**
- Overall dependency risk: **Moderate**

## Open Source License Inventory

Production dependency license counts from `license-checker`:

### Backend

- MIT: 125
- Apache-2.0: 10
- ISC: 6
- BSD-3-Clause: 3
- BSD-2-Clause: 3
- 0BSD: 1
- MIT*: 1
- UNLICENSED: 1 (`backend` package itself, private)

### Mobile

- MIT: 449
- ISC: 26
- Apache-2.0: 12
- BSD-2-Clause: 12
- BSD-3-Clause: 8
- BlueOak-1.0.0: 6
- Unlicense: 2
- MPL-2.0: 2
- (MIT OR CC0-1.0): 2
- Python-2.0: 1
- CC-BY-4.0: 1
- (MIT OR Apache-2.0): 1
- 0BSD: 1
- CC0-1.0: 1
- (BSD-3-Clause OR GPL-2.0): 1
- UNLICENSED: 1 (`mobile` package itself, private)

## Open Source License Risk Assessment

### Low-Risk / standard permissive families

- MIT
- Apache-2.0
- BSD-2-Clause
- BSD-3-Clause
- ISC
- 0BSD
- BlueOak-1.0.0
- Unlicense
- CC0-1.0

These are generally compatible with closed-source commercial distribution, subject to preserving copyright and license notices.

### Medium-Risk / review-needed licenses

- MPL-2.0
  - File-level copyleft. Usually manageable, but modifications to MPL-covered files may trigger source-sharing obligations for those files.
  - Detected in `lightningcss` packages.

- CC-BY-4.0
  - Attribution is required.
  - Detected in `caniuse-lite`; usually low operational burden, but notice handling should be explicit.

- `(BSD-3-Clause OR GPL-2.0)`
  - The safer path is to rely on the BSD option if valid for the package use and documentation.
  - Detected in `node-forge`.

- `MIT*`
  - Ambiguous notation from package metadata rather than a separate risky license, but it merits manual confirmation.
  - Detected in `pause@0.0.1`.

### License Conclusions

- No AGPL, SSPL, or GPL-only production dependency was identified.
- No immediate blocker to commercial distribution was found.
- Main license work items are notice hygiene and manual review of the few non-standard or dual-license packages.

## Consolidated Risk Score

Scoring model:

- 0.0 to 2.9: Low
- 3.0 to 5.9: Moderate
- 6.0 to 7.9: Moderate-High
- 8.0 to 10.0: High-Critical

Component scores:

- Application security: **6.8 / 10**
- Dependency vulnerability risk: **5.9 / 10**
- Open source license risk: **3.8 / 10**
- Operational security hygiene: **7.5 / 10**

Weighted consolidated score: **6.4 / 10 (Moderate-High)**

Interpretation:

- The app is not structurally unsafe, but it is not ready for a production security signoff until credential hygiene and dependency remediation are addressed.

## Mitigation Plan

### Immediate (0 to 7 days)

1. Rotate all secrets present in tracked `.env` files.
2. Remove `.env` and `backend/.env` from version control; replace with templates only.
3. Remove hardcoded pilot/demo passwords from client code and seed scripts.
4. Restrict or disable any reachable demo/pilot accounts seeded with known credentials.
5. Upgrade the vulnerable `multer` path or pin a fixed transitive resolution after compatibility testing.

### Near Term (1 to 3 weeks)

1. Move browser auth away from storage-readable bearer tokens where feasible, especially for admin.
2. Enforce stronger user password rules and consider breached-password screening.
3. Add CI gates for:
   - `npm audit` on production dependencies
   - secret scanning
   - license policy checks
4. Add a production CSP for any web/admin deployment.

### Medium Term (1 to 2 months)

1. Add MFA for admin users.
2. Introduce centralized secret management for non-local environments.
3. Create a software bill of materials and third-party notices bundle for releases.
4. Review and document obligations for MPL-2.0 and CC-BY-4.0 dependencies.

## Validation Notes and Limitations

- Targeted security integration tests were executed with `npm test -- --runInBand security.integration.spec.ts`.
- Result: **partially failed due existing test-state conflicts** (`409 Conflict` during room creation), so the suite does not currently provide a clean regression signal.
- This review focused on code and dependency posture visible in the workspace. It did not include live infrastructure review, cloud IAM review, SAST/DAST enterprise tooling, penetration testing, or mobile binary reverse-engineering.
