# Vercel Production Deployment Guide

This guide details the step-by-step setup to deploy the Moped Momos backend and web app to Vercel.

---

## 1. Quick Verification Checklist

Before deploying, verify everything compiles cleanly locally:
```bash
npm run typecheck   # Verified 0 errors
npm run lint        # Verified 0 warnings / errors
npm test            # 46/46 tests pass
npm run build       # Next.js production build succeeds
```

---

## 2. Generate Secrets

Run these in PowerShell or Node to generate cryptographically secure secrets:

```bash
# AUTH_SECRET (64 hex characters)
node -e "console.log(crypto.randomBytes(32).toString('hex'))"

# GOOGLE_TOKEN_ENCRYPTION_KEY (32 bytes base64)
node -e "console.log(crypto.randomBytes(32).toString('base64'))"

# CRON_SECRET (random string for Vercel Cron authorization)
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

---

## 3. Remote Turso Database

Vercel functions are stateless and require a remote Turso database (`libsql://...`).

1. Create a database in [Turso](https://turso.tech/):
   ```bash
   turso db create moped-momos
   turso db show moped-momos --url
   turso db tokens create moped-momos
   ```
2. Run database migrations to prepare all production tables:
   ```bash
   # On Windows PowerShell:
   $env:TURSO_DATABASE_URL="libsql://moped-momos-<org>.turso.io"
   $env:TURSO_AUTH_TOKEN="<your-turso-token>"
   npm run db:migrate
   ```

---

## 4. Google OAuth Configuration

1. Visit [Google Cloud Console](https://console.cloud.google.com/) -> **APIs & Services** -> **Credentials**.
2. Configure **OAuth Consent Screen**:
   - User Type: External
   - Add Scopes: `openid`, `email`, `.../auth/drive.file`
   - Add Test Users (while in Testing status): Add the exact owner Google email (`OWNER_GOOGLE_EMAIL`).
3. Create **OAuth 2.0 Client ID**:
   - Application type: **Web application**
   - Name: `Moped Momos Web Client`
   - Authorized JavaScript origins:
     - `https://your-app.vercel.app` (and your custom domain if applicable)
   - Authorized redirect URIs:
     - `https://your-app.vercel.app/api/auth/google/callback`

---

## 5. Ably Realtime Setup

1. In [Ably](https://ably.com/), create an app and obtain the **API Root Key**.
2. Set `ABLY_API_KEY` in environment variables.
3. Default channel: `ABLY_CHANNEL=moped-production-orders`.

---

## 6. Vercel Environment Variables

Set the following in **Vercel Project Settings -> Environment Variables** (for Production & Preview):

| Variable | Description | Example / Format |
|---|---|---|
| `TURSO_DATABASE_URL` | Remote Turso database URL | `libsql://your-db-org.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso database authentication token | `eyJ...` |
| `APP_ORIGIN` | Your live Vercel app URL | `https://your-app.vercel.app` |
| `AUTH_SECRET` | 64 random hex characters | Generated via step 2 |
| `CRON_SECRET` | Vercel Cron webhook bearer secret | Generated via step 2 |
| `OWNER_GOOGLE_EMAIL` | Single authorized Google account | `owner@gmail.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET`| Google OAuth Client Secret | `GOCSPX-...` |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | 32 random bytes, base64-encoded | Generated via step 2 |
| `ABLY_API_KEY` | Server API key for Ably | `key_id:key_secret` |
| `ABLY_CHANNEL` | Ably real-time channel | `moped-production-orders` |
| `NATIVE_WEB_ORIGIN` *(Optional)* | Separate Expo web preview URL | `https://orders.yourdomain.com` |

---

## 7. Deploying to Vercel

### Option A: Via GitHub (Recommended)
1. Initialize git and commit:
   ```bash
   git init
   git add .
   git commit -m "Production ready for Vercel deployment"
   ```
2. Push to your GitHub repository.
3. In [Vercel Dashboard](https://vercel.com/new), select **Import Git Repository**.
4. Framework Preset will auto-detect as **Next.js**.
5. Paste your Environment Variables and click **Deploy**.

### Option B: Via Vercel CLI
```bash
npm i -g vercel
vercel
vercel --prod
```

---

## 8. Post-Deployment Verification

1. Navigate to `https://your-app.vercel.app/login`
2. Click **Continue with Google** and sign in with `OWNER_GOOGLE_EMAIL`.
3. Verify kitchen route loads at `https://your-app.vercel.app/k/<kitchen-token>`.
4. Test health check endpoint: `GET https://your-app.vercel.app/api/admin/health` (requires owner session).
5. The daily outbox cron configured in `vercel.json` (`/api/cron/outbox`) will automatically be scheduled in the Vercel Dashboard under **Project Settings -> Cron Jobs**.
