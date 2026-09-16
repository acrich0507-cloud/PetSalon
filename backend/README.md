# PetSalon Backend

Backend APIs for:

1. Resolve LIFF ID from database
2. Bind LINE user to petsalon.user

## Endpoints

1. GET /health
2. GET /api/public/liff/resolve
3. POST /api/public/line/bind-user

## Environment Variables

Copy .env.example to .env and fill values.

- PORT: API port, default 8080
- SUPABASE_URL: your Supabase URL
- SUPABASE_SERVICE_ROLE_KEY: backend secret key
- CORS_ORIGINS: comma-separated allowed origins

Example:

CORS_ORIGINS=https://your-account.github.io,https://your-custom-domain.com

## Run locally

1. npm install
2. npm run dev

## API examples

### GET resolve

GET /api/public/liff/resolve?shop_code=SHOP_TPE_001

Response:

{
  "ok": true,
  "shopId": "SHOP_TPE_001",
  "liffId": "1650000000-xxxxxxx"
}

### POST bind-user

POST /api/public/line/bind-user
Content-Type: application/json

{
  "shopId": "SHOP_TPE_001",
  "lineUserId": "Uxxxxxxxxxxxxx",
  "lineDisplayName": "Alan"
}

## Cloud Run deploy note

1. Build and deploy with Node.js runtime
2. Set all env vars in Cloud Run service
3. Keep SUPABASE_SERVICE_ROLE_KEY in Secret Manager when possible

## Create new Cloud Run service (PetSalon)

Cloud Run service names must be lowercase. Use petsalon (not PetSalon).

1. Open PowerShell in backend folder.
2. Run:

```powershell
Set-Location "F:\Project\PetSalon\backend"
./deploy-cloud-run.ps1 `
  -ProjectId "your-gcp-project" `
  -Region "asia-east1" `
  -ServiceName "petsalon" `
  -SupabaseUrl "https://xxxx.supabase.co" `
  -SupabaseServiceRoleKey "your-service-role-key" `
  -CorsOrigins "https://your-frontend-domain.com"
```

After deployment, the script prints your Cloud Run URL.
