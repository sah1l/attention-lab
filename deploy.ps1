# Deploys Attention Lab to Google Cloud Run.
#
# Usage:
#   .\deploy.ps1 -ProjectId my-gcp-project
#   .\deploy.ps1 -ProjectId my-gcp-project -Region asia-south1 -ServiceName attention-lab
#   .\deploy.ps1 -ProjectId my-gcp-project -EnvFile .env
#
# Prereqs:
#   - gcloud CLI installed and authenticated (`gcloud auth login`)
#   - Billing enabled on the project
#   - Cloud Run, Cloud Build, and Artifact Registry APIs will be enabled by this script

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "us-central1",

    [string]$ServiceName = "attention-lab",

    [string]$RepoName = "attention-lab",

    [string]$EnvFile = ".env",

    [switch]$SkipEnv
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Invoke-Checked {
    param([string]$Label, [scriptblock]$Block)
    & $Block
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "ERROR: '$Label' failed with exit code $LASTEXITCODE." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

# 1. Set project
Write-Step "Setting active gcloud project to '$ProjectId'"
gcloud config set project $ProjectId | Out-Null

# 2. Enable required APIs
Write-Step "Enabling required APIs (Cloud Run, Cloud Build, Artifact Registry)"
gcloud services enable `
    run.googleapis.com `
    cloudbuild.googleapis.com `
    artifactregistry.googleapis.com | Out-Null

# 3. Ensure Artifact Registry repo exists
Write-Step "Ensuring Artifact Registry repo '$RepoName' exists in $Region"
$repoExists = gcloud artifacts repositories describe $RepoName --location=$Region 2> $null
if (-not $repoExists) {
    gcloud artifacts repositories create $RepoName `
        --repository-format=docker `
        --location=$Region `
        --description="Attention Lab container images" | Out-Null
    Write-Host "    Created repo '$RepoName'."
} else {
    Write-Host "    Repo '$RepoName' already exists."
}

# 4. Build & push image via Cloud Build
$imageUri = "$Region-docker.pkg.dev/$ProjectId/$RepoName/${ServiceName}:latest"
Write-Step "Building and pushing image: $imageUri"
Invoke-Checked "gcloud builds submit" { gcloud builds submit --tag $imageUri }

# 5. Build env-var argument from .env (skip blanks/comments)
$envArg = @()
if (-not $SkipEnv) {
    if (Test-Path $EnvFile) {
        Write-Step "Reading env vars from '$EnvFile'"
        $pairs = @()
        Get-Content $EnvFile | ForEach-Object {
            $line = $_.Trim()
            if (-not $line) { return }
            if ($line.StartsWith("#")) { return }
            if ($line -notmatch "=") { return }
            # Strip surrounding quotes from value if present
            $key, $value = $line.Split("=", 2)
            $value = $value.Trim().Trim('"').Trim("'")
            if (-not $value) { return }
            $pairs += "$key=$value"
            Write-Host "    $key"
        }
        if ($pairs.Count -gt 0) {
            $envArg = @("--set-env-vars", ($pairs -join ","))
        }
    } else {
        Write-Host "    No '$EnvFile' found — deploying without app env vars (fallback mode will be used)." -ForegroundColor Yellow
    }
}

# 6. Deploy to Cloud Run
Write-Step "Deploying '$ServiceName' to Cloud Run in $Region"
$deployArgs = @(
    "run", "deploy", $ServiceName,
    "--image", $imageUri,
    "--region", $Region,
    "--platform", "managed",
    "--allow-unauthenticated",
    "--port", "8080",
    "--memory", "512Mi",
    "--cpu", "1",
    "--min-instances", "0",
    "--max-instances", "5"
) + $envArg

Invoke-Checked "gcloud run deploy" { & gcloud @deployArgs }

# 7. Print URL
Write-Step "Deployment complete"
$url = gcloud run services describe $ServiceName --region $Region --format="value(status.url)"
Write-Host ""
Write-Host "Service URL: $url" -ForegroundColor Green
Write-Host ""
