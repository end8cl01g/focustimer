# deploy.ps1
# Builds the Docker image and deploys to Cloud Run with Environment Variables

# 1. Load Environment Variables from .env
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $name = $matches[1]
            $value = $matches[2]
            Set-Variable -Name $name -Value $value -Scope script
        }
    }
}
else {
    Write-Error ".env file not found!"
    exit 1
}

# 2. Check for Credential File
if (-not (Test-Path "service-account.json")) {
    Write-Error "service-account.json not found!"
    exit 1
}

# 3. Read and Minify JSON Key (Simple approach)
$CredsJson = Get-Content "service-account.json" -Raw
# Remove newlines and extra spaces to fit in env var
$CredsJson = $CredsJson -replace '\r\n', '' -replace '\n', '' -replace '\s+', ' '

Write-Host "Project ID: $GCP_PROJECT_ID"
Write-Host "Bot Token: $TELEGRAM_BOT_TOKEN"
Write-Host "Building image..."

# 4. Submit Build (Build and Push)
gcloud builds submit --config cloudbuild.yaml --project $GCP_PROJECT_ID .

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed."
    exit 1
}

Write-Host "Deploying to Cloud Run..."

# 5. Deploy with Env Vars
gcloud run deploy focustimer-bot `
    --image gcr.io/$GCP_PROJECT_ID/focustimer-bot `
    --project $GCP_PROJECT_ID `
    --region asia-east1 `
    --platform managed `
    --allow-unauthenticated `
    --set-env-vars NODE_ENV="production", TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN", GOOGLE_CREDENTIALS_JSON="$CredsJson", GOOGLE_CALENDAR_ID="$GOOGLE_CALENDAR_ID"

Write-Host "Deployment Complete!"
