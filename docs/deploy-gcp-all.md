# PetSalon 全新 GCP 部署流程

目標架構：

1. 前端：Google Cloud Storage
2. 後端：Cloud Run
3. 資料庫：Supabase

## 一次性準備

1. 確認 GitHub repo 已建立且程式已推上 main 分支。
2. 建立 GCP Service Account，至少給以下權限：
- Cloud Run Admin
- Storage Admin
- Service Account User
- Cloud Build Editor

3. 產生 Service Account JSON key。

## GitHub Secrets

到 GitHub repo -> Settings -> Secrets and variables -> Actions，新建：

1. GCP_SA_KEY
- 內容放 Service Account JSON 全文

2. SUPABASE_URL
- 例如 https://xxxx.supabase.co

3. SUPABASE_SERVICE_PETSALON_KEY
- Supabase service role key for petsalon-backend

## 執行全新部署 Workflow

1. 到 GitHub repo -> Actions
2. 選 Deploy PetSalon To Google Cloud
3. 按 Run workflow，填入：
- project_id: 你的 GCP project id
- region: asia-east1
- service_name: petsalon
- frontend_bucket: 例如 petsalon-frontend-prod
- cors_origins: 例如 https://pet.example.com

## 部署完成後

1. 後端 API URL
- 會在 workflow Summary 印出 Backend URL

2. 前端暫時測試網址
- https://storage.googleapis.com/{frontend_bucket}/index.html

3. 正式環境建議
- 將 bucket 掛到 Cloud CDN + HTTPS Load Balancer
- 在 LINE Developers 把 LIFF endpoint 換成正式網域

## 注意

1. Cloud Run 服務名稱必須小寫，建議固定用 petsalon。
2. 不要把任何 secret 放進前端檔案或 repo。
3. 前端 app-config.js 會在部署時自動注入後端 URL。
