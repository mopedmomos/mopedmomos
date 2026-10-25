# Version 3 verification

Production entrypoints have no sample repositories, orders, menu seed or sample access. Legacy password login endpoints return 410; their server implementation and administrator provisioning scripts were removed. Migration 005 invalidates old sessions and administrators without deleting real operational records.

46 backend tests passed, including Google exact-email/verified-email/nonce rejection, pinned subject checks, allowed redirect validation, one-use callback and client-PKCE handoff, encrypted Drive authorization, private Drive upload, fresh-auth/typed-confirmation deletion, account tombstone lockout, and the existing financial/order/Kitchen regression suite. Google/Drive network responses were mocked; no real Google account was connected and no real account was deleted. Native domain tests also passed (21).

The backend production build and native strict TypeScript check passed. Orders and Kitchen web and Android Hermes exports passed; Orders, Kitchen and the separate wrapper iOS Hermes exports passed. Browser QA at 320px showed the Google-only owner login without sample/password controls and the Kitchen viewing-link entry without a Google login. Screenshots were inspected internally. Authenticated screens and real service flows could not be exercised without production OAuth/backend configuration.

No real Google OAuth client, owner email, backend production environment, Expo project or Apple signing account has been configured. Source/configuration preparation does not establish a live Google connection or produce a signed IPA. The private Site remains a locked frontend awaiting configuration. No external account credentials were obtained or published.
