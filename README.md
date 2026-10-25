# Moped Momos — production backend

Version 3 uses Google-only owner authentication. The Orders UI is the Expo app in `mobile/`, also exported for web. Kitchen needs no user login: its separate private viewing token grants read-only kitchen access. No sample mode, demo orders, password accounts or automatic menu seeding remain.

## Required setup

1. Create a production Turso database and set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` privately on the backend host.
2. Register a Google **Web application** OAuth client. Add the exact redirect URI `https://YOUR_BACKEND/api/auth/google/callback`. Enable Google Drive API and configure the consent screen. Permit the selected owner as a test user while testing.
3. Set `AUTH_SECRET` to a long random server secret for persisted login rate limits. Set the server-only `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `OWNER_GOOGLE_EMAIL`. The latter must be the exact one allowed Google email; leaving it empty rejects every account. Both verified email and immutable Google subject are checked. There is no first-login owner claim or alternative password login.
4. Set `GOOGLE_TOKEN_ENCRYPTION_KEY` to 32 random bytes encoded as base64. Set `APP_ORIGIN` to the HTTPS backend origin and `NATIVE_WEB_ORIGIN` to the exact HTTPS Expo web frontend origin. Keep all secrets out of source and the mobile build.
5. Install root dependencies with `npm ci`, run `npm run db:migrate`, then `npm run build` and deploy the Next.js backend. Migration 005 revokes all legacy sessions/password administrators, without deleting actual existing menu/order records. A new database starts empty. Menu fixtures live only under tests.
6. Configure the mobile/web public backend URL and follow `README-NATIVE.md`. Existing local preview/sample caches are removed when the new app opens.

Google sign-in uses the official Google authentication library on the server. Each request has a nonce, Google PKCE, a one-use expiring server state, and a separate client PKCE-bound handoff. Only hashed session and handoff secrets are stored. Browser sessions use secure HttpOnly cookies; native sessions use bearer tokens held in SecureStore. The separately hosted Expo web frontend holds bearer sessions in memory, so reloading requires Google sign-in. Temporary OAuth PKCE state survives only long enough to finish the redirect.

## Google Drive images

In Orders → Account & Drive, connect the **same** Google owner account. The app requests `drive.file`, uploads optimized photos through the authenticated backend, and does not add public sharing permissions. Refresh tokens are encrypted using AES-256-GCM. An optimized private menu copy renders in the counter without exposing Drive tokens or making files public. Disconnect removes stored authorization and requests revocation from Google. Built-in photo choices remain available.

## Account deletion

Orders → Account & Drive → Delete account requires a Google sign-in within the last five minutes and typing `DELETE`. It deletes the app owner identity, menu, orders, payment/audit records, connections and local draft, invalidates all app sessions and viewing links, and requests Google token revocation. Existing files in the owner's personal Drive remain there; the Google account itself is not deleted. A non-identifying `account_deleted` marker prevents automatic re-registration. Deliberate restoration requires the deployment owner to reset this marker and configure the intended owner privately; the app offers no account-switch or reset bypass.

## Kitchen

Only GET endpoints accept the Kitchen token. Kitchen projections contain no prices, payments, Drive authorization or photos. Cards are generated from actual unserved ordered items, hide at zero, retain separate portions and follow Dine-in / Parcel filtering. Only Orders can mark an order served.

## Verification and limits

Run `npm test` and `npm run typecheck`. Backend integration tests use an isolated database and mocked Google/Drive responses. Real OAuth consent, real Drive uploads, physical iOS/Android operation, cloud signing and store distribution require the owner's production configuration. The private published Site is a locked frontend until its backend and Google client are configured; publishing frontend assets does not deploy Turso or the Next.js API.
