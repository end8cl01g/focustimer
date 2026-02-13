# setup.ps1 - Google Cloud Setup Script

param (
    [string]$ProjectId,
    [string]$Region = "asia-east1"
)

if (-not $ProjectId) {
    Write-Host "Please provide a Project ID."
    $ProjectId = Read-Host "Project ID"
}

Write-Host "Setting up project: $ProjectId in region: $Region"

# 1. Set Project
gcloud config set project $ProjectId

# 2. Enable APIs
Write-Host "Enabling APIs..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com calendar-json.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com

# 3. Create Service Account
$SaName = "focustimer-bot"
$SaEmail = "$SaName@$ProjectId.iam.gserviceaccount.com"

Write-Host "Creating Service Account: $SaName..."
if (-not (gcloud iam service-accounts list --filter="email:$SaEmail" --format="value(email)")) {
    gcloud iam service-accounts create $SaName --display-name="Focus Timer Bot Service Account"
}

# 4. Create Key
if (-not (Test-Path "service-account.json")) {
    Write-Host "Creating service-account.json key..."
    gcloud iam service-accounts keys create service-account.json --iam-account=$SaEmail
} else {
    Write-Host "service-account.json already exists. Skipping creation."
}

# 5. Create Artifact Registry
$RepoName = "focustimer-repo"
Write-Host "Creating Artifact Registry repository: $RepoName..."
if (-not (gcloud artifacts repositories list --project=$ProjectId --location=$Region --filter="name:$RepoName" --format="value(name)")) {
    gcloud artifacts repositories create $RepoName --repository-format=docker --location=$Region --description="Docker repository for Focus Timer Bot"
}

Write-Host "Setup Complete!"
Write-Host "1. Share your Google Calendar with this email: $SaEmail"
Write-Host "2. Add TELEGRAM_BOT_TOKEN to Secret Manager (optional for simple setup, required for production security)."
Write-Host "3. Update your .env file with the values."
