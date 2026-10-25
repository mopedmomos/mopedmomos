# Render Production Deployment Guide

This guide details how to deploy the Moped Momos web service to **Render** and pair it with **Turso**.

---

## 1. Turso Location Selection

In Turso:
- Choose **`AWS AP South (Mumbai)`** as the primary location.
- **Why?** Moped Momos operates in India (IST timezone, INR currency). Having the database hosted in Mumbai gives the lowest latency for your counter, kitchen, and customers.

---

## 2. Render Settings (From Your Screen)

When creating the **New Web Service** on Render:

| Field | Value to Enter / Select |
|---|---|
| **Name** | `moped-momos` (or your preferred name) |
| **Language** | `Node` |
| **Branch** | `main` |
| **Region** | **`Singapore (Southeast Asia)`** *(Closest Render region to India, giving ~35ms latency to Mumbai Turso)* |
| **Root Directory** | *(Leave blank / empty)* |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |
| **Instance Type** | Free or Starter ($7/mo) |

---

## 3. Generate Encryption & Secret Keys

Run these in PowerShell or Node on your machine to generate strong random keys:

```powershell
# AUTH_SECRET (64 hex characters)
node -e "console.log(crypto.randomBytes(32).toString('hex'))"

# GOOGLE_TOKEN_ENCRYPTION_KEY (32 bytes base64)
node -e "console.log(crypto.randomBytes(32).toString('base64'))"

# CRON_SECRET (random secret string)
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

---

## 4. Run Turso Migrations

Once your Turso database is created in Mumbai:
1. Copy the Database URL (`libsql://moped-momos-<org>.turso.io`) and create a Token.
2. In PowerShell, apply the database schema:
```powershell
$env:TURSO_DATABASE_URL="libsql://moped-momos-<org>.turso.io"
$env:TURSO_AUTH_TOKEN="<your-turso-token>"
npm run db:migrate
```

---

## 5. Environment Variables on Render

In your Render Service settings -> **Environment**:

| Key | Value |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://moped-momos-<org>.turso.io` |
| `TURSO_AUTH_TOKEN` | `<your-turso-token>` |
| `APP_ORIGIN` | `https://<your-service-name>.onrender.com` |
| `AUTH_SECRET` | *(64-character hex key generated in step 3)* |
| `CRON_SECRET` | *(Random secret generated in step 3)* |
| `OWNER_GOOGLE_EMAIL` | `your-exact-email@gmail.com` |
| `GOOGLE_CLIENT_ID` | `...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | *(32-byte base64 key generated in step 3)* |
| `ABLY_API_KEY` | `<your-ably-key>` |
| `ABLY_CHANNEL` | `moped-production-orders` |
| `NODE_VERSION` | `20` or `22` |

---

## 6. Google Cloud OAuth Update

In Google Cloud Console -> **APIs & Services** -> **Credentials** -> your Web Client:
- **Authorized JavaScript origins**:
  - `https://<your-service-name>.onrender.com`
- **Authorized redirect URIs**:
  - `https://<your-service-name>.onrender.com/api/auth/google/callback`

---

## 7. Outbox Sweep Cron on Render (Optional)

On Render, the server runs continuously (unlike serverless Vercel), and in-memory background sweeps automatically occur when orders are created or updated.

If you want a scheduled backup sweep:
- Create a **Cron Job** in Render.
- Command: `curl -H "Authorization: Bearer $CRON_SECRET" https://<your-service-name>.onrender.com/api/cron/outbox`
- Schedule: `0 0 * * *` (daily) or `0 * * * *` (hourly).
