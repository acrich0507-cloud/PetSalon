param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $false)]
  [string]$Region = "asia-east1",

  [Parameter(Mandatory = $false)]
  [string]$ServiceName = "petsalon",

  [Parameter(Mandatory = $true)]
  [string]$SupabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$SupabaseServicePetsalonKey,

  [Parameter(Mandatory = $false)]
  [string]$SupabaseSchema = "petsalon",

  [Parameter(Mandatory = $true)]
  [string]$CorsOrigins
)

$ErrorActionPreference = "Stop"

if ($ServiceName -cmatch "[A-Z]") {
  throw "Cloud Run service name cannot include uppercase letters. Use lowercase, e.g. petsalon."
}

Write-Host "[1/4] Set gcloud project"
gcloud config set project $ProjectId | Out-Null

Write-Host "[2/4] Enable Cloud Run and build services"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project $ProjectId | Out-Null

Write-Host "[3/4] Deploy backend service from source"
gcloud run deploy $ServiceName `
  --source . `
  --region $Region `
  --allow-unauthenticated `
  --set-env-vars "SUPABASE_URL=$SupabaseUrl,SUPABASE_SERVICE_PETSALON_KEY=$SupabaseServicePetsalonKey,SUPABASE_SCHEMA=$SupabaseSchema,CORS_ORIGINS=$CorsOrigins" `
  --project $ProjectId

Write-Host "[4/4] Print service URL"
$serviceUrl = gcloud run services describe $ServiceName --region $Region --project $ProjectId --format="value(status.url)"
Write-Host "Service deployed: $serviceUrl"
