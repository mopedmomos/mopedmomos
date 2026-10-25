# Moped Momos — Expo applications, version 3

| Target | Role | Account access |
| --- | --- | --- |
| `orders` | Native React Native order counter and web frontend | One allowlisted Google owner |
| `kitchen` | Separate view-only kitchen | Private viewing link; no login |
| `wrapper` | iOS WKWebView wrapper for the production Orders website | Same Google owner; OAuth opens the system browser |

The Orders and Kitchen targets use native React Native views. The additional iOS wrapper deliberately hosts the Orders web frontend. All targets have independent bundle identifiers/schemes. No target offers demo/sample access or a password login. New production databases start without orders or menu items; add your real items in Menu & pricing.

## Configure and run

Install dependencies in `mobile/` with `npm ci`. Set `EXPO_PUBLIC_API_URL` to the HTTPS production backend. The production app fixes this URL at build time and does not offer a backend/account switch on its login screen. These are public URLs, never secrets. Complete the Google/Turso setup in root `README.md` first. For the wrapper, also set `EXPO_PUBLIC_WEB_APP_URL` to the production HTTPS Expo Orders website. Use a website that can be accessed directly with its app-level Google login; an author-only ChatGPT preview may have an additional platform access gate.

Run `npm run start:orders`, `npm run start:kitchen` or `npm run start:wrapper`. Test OAuth using a development or standalone build with the configured native scheme, rather than Expo Go's shared scheme. In web builds the owner session is intentionally memory-only and a page reload requires another Google sign-in. The Google Drive authorization redirect issues a fresh owner session when it returns.

## iOS builds and IPA

The EAS profiles are already prepared:

```sh
npx eas-cli build --platform ios --profile orders-ios
npx eas-cli build --platform ios --profile kitchen-ios
npx eas-cli build --platform ios --profile wrapper-ios
```

Internal device builds require an Expo project, Apple signing credentials and registered test devices. Profiles ending `-ios-store` target App Store/TestFlight distribution; `-ios-simulator` build for a simulator instead of producing an installable phone IPA. Set the appropriate public backend/web URLs in the EAS environment before building. No signing keys or Apple credentials belong in source. This workspace has no authenticated Expo/Apple account or Xcode toolchain; **no signed IPA is included**. JavaScript/Hermes export success is not a signed native compilation or a device test.

The wrapper allows the configured HTTPS website only, opens Google OAuth with the system authentication browser, validates callback scheme and hands a short-lived PKCE-protected code back to the web frontend. It does not collect Google passwords or load Google login inside an embedded web view. External HTTPS links open separately. Network errors expose a retry action. Status bars and safe-area insets are configured for phones and tablets.

## Android

Use `orders-apk` / `kitchen-apk` for internal APKs and `orders-production` / `kitchen-production` for Play Store bundles. Run the EAS CLI with `--platform android` and the selected profile. No signed APK is included without account/signing setup.

## Counter and Kitchen behavior

Dine-in and Parcel are fixed adjacent cards with independent quantities and notes. Review shows all lines and shared instructions. Online payment generates an exact-amount UPI QR using the original supplied payee; Cash does not show QR. Payment can remain pending. Transfers require manual confirmation. Queue tickets have one service action: Mark served.

Menu & pricing lets the owner add items, set portions/prices and upload photos to the connected owner Google Drive. Account & Drive manages the connection and confirmed account deletion. Photo optimization limits size before upload; no camera/microphone permission is requested. Kitchen never signs in, never mutates orders, and shows only items with unserved quantities. Every portion has its own dynamic count card. Cards disappear at zero.

Layouts use native flex, safe areas, scrollable forms, keyboard avoidance, 44-point touch controls, SVG icons, two service columns and responsive Kitchen grids. Orders web is constrained to a mobile-first frame. Both entry screens support 320px widths.

## Checks

```sh
npm test
npm run typecheck
npm run export:orders:web
npm run export:kitchen:web
npm run export:orders:ios
npm run export:kitchen:ios
npm run export:wrapper:ios
```

Shared domain/presentation/UPI contracts synchronize from the root via `node scripts/sync-mobile-domain.mjs`. Sample fixtures exist only in tests and are not imported by app entrypoints.
