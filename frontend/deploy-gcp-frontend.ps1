param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $true)]
  [string]$BucketName,

  [Parameter(Mandatory = $false)]
  [string]$Region = "asia-east1"
)

$ErrorActionPreference = "Stop"

Write-Host "[1/5] Set gcloud project"
gcloud config set project $ProjectId | Out-Null

Write-Host "[2/5] Enable required services"
gcloud services enable storage.googleapis.com compute.googleapis.com certificatemanager.googleapis.com dns.googleapis.com --project $ProjectId | Out-Null

Write-Host "[3/5] Create bucket if missing"
$bucketUri = "gs://$BucketName"
$exists = $true
try {
  gcloud storage buckets describe $bucketUri --project $ProjectId | Out-Null
} catch {
  $exists = $false
}

if (-not $exists) {
  gcloud storage buckets create $bucketUri --location=$Region --uniform-bucket-level-access
}

Write-Host "[4/5] Upload frontend files"
gcloud storage rsync "." "$bucketUri" --recursive --exclude="deploy-gcp-frontend.ps1|app-config.example.js|README.md"

Write-Host "[5/5] Set object cache policy"
gcloud storage objects update "$bucketUri/**" --cache-control="public,max-age=300" | Out-Null

Write-Host "Done. Frontend files uploaded to $bucketUri"
Write-Host "Next: Configure Cloud CDN + HTTPS Load Balancer for public website hosting."
