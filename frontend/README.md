# LIFF Auto Detect Entry

This frontend auto-detects liff_id after users enter from browser or LINE.

Current target architecture:

1. Frontend: Google Cloud static hosting (Cloud Storage + Cloud CDN)
2. Backend API: Google Cloud Run
3. Database: Supabase PostgreSQL

## Production behavior

1. LIFF ID is resolved from backend database mapping only.
2. Frontend requires backend API to return shopId and liffId.
3. Query override and local fallback are disabled by STRICT_DB_LIFF = true.

## API base configuration

Set API base in app-config.js:

window.APP_CONFIG = {
  apiBase: "https://your-cloud-run-service-url"
};

You can copy app-config.example.js to app-config.js.

## URL convention

1. Preferred path: /s/{shopCode}
2. Alternate query: ?shop_code={shopCode}

## Required backend endpoint

### GET /api/public/liff/resolve

Input query:

1. host
2. path
3. shop_code (optional if path already contains /s/{shopCode})

Response example:

{
  "ok": true,
  "shopId": "SHOP_TPE_001",
  "liffId": "1650000000-xxxxxxx"
}

Supabase mapping source:

1. schema: petsalon
2. table: shop
3. key: sh_id
4. value: sh_liff_id

### POST /api/public/line/bind-user

Called after liff.getProfile() to upsert user into petsalon.user.

## Deploy to GCP

1. Edit app-config.js and set apiBase to Cloud Run URL.
2. Run PowerShell script in this folder:

./deploy-gcp-frontend.ps1 -ProjectId "your-gcp-project" -BucketName "your-frontend-bucket"

3. Configure Cloud CDN + HTTPS Load Balancer for that bucket.
4. Add frontend domain to backend CORS allowlist.
5. Update LIFF endpoint URL in LINE Developers to your new GCP frontend domain.

## Security checklist

1. Never put Supabase service role key in frontend files.
2. Keep secrets in Cloud Run environment or Secret Manager only.
3. Use backend resolver as the only LIFF ID source in production.
