# Deploying Attention Lab to Google Cloud Run

This app is a standalone Next.js server packaged as a container. It deploys cleanly to Cloud Run.

## What's in the box

- **`Dockerfile`** — multi-stage build that produces a small `node:20-alpine` runtime image using Next.js standalone output.
- **`.dockerignore`** — keeps `node_modules`, build caches, dotenv files, and logs out of the build context.
- **`next.config.mjs`** — sets `output: "standalone"` so `next build` emits a self-contained `server.js`.
- **`deploy.ps1`** — one-shot PowerShell script that enables APIs, creates the Artifact Registry repo, builds the image with Cloud Build, and deploys to Cloud Run with env vars from your `.env`.

## Prerequisites

1. **Google Cloud project** with billing enabled.
2. **`gcloud` CLI** installed and authenticated:
   ```powershell
   gcloud auth login
   gcloud auth application-default login
   ```
3. A populated **`.env`** file in the repo root (same keys as `.env.example`):
   ```
   OPENAI_API_KEY=...
   OPENAI_BASE_URL=...
   AI_MODEL=...
   ```
   If `.env` is missing, the app falls back to its bundled corpus and deterministic tutor — the demo still works, just without live AI generation.

## One-shot deploy

From the repo root in PowerShell:

```powershell
.\deploy.ps1 -ProjectId your-gcp-project-id
```

Defaults:

| Param          | Default          |
|----------------|------------------|
| `-Region`      | `us-central1`    |
| `-ServiceName` | `attention-lab`  |
| `-RepoName`    | `attention-lab`  |
| `-EnvFile`     | `.env`           |

Override any of them, e.g.:

```powershell
.\deploy.ps1 -ProjectId your-gcp-project-id -Region asia-south1 -ServiceName attention-lab-prod
```

To deploy without injecting env vars (uses fallback mode):

```powershell
.\deploy.ps1 -ProjectId your-gcp-project-id -SkipEnv
```

The script prints the public service URL when it finishes.

## What the script does

1. `gcloud config set project <ProjectId>`
2. Enables `run`, `cloudbuild`, and `artifactregistry` APIs.
3. Creates Artifact Registry Docker repo `<RepoName>` in `<Region>` (skips if it already exists).
4. `gcloud builds submit` — builds the image from the `Dockerfile` and pushes to Artifact Registry.
5. Reads `.env`, converts each non-comment, non-blank line into a `KEY=value` pair, and passes them as `--set-env-vars` to Cloud Run.
6. `gcloud run deploy` with sensible defaults: `--allow-unauthenticated`, port `8080`, 512 MiB / 1 vCPU, min instances 0, max 5.
7. Prints the resolved Cloud Run URL.

## Manual deploy (if you'd rather not run the script)

```powershell
$Project = "your-gcp-project-id"
$Region  = "us-central1"
$Service = "attention-lab"
$Repo    = "attention-lab"
$Image   = "$Region-docker.pkg.dev/$Project/$Repo/${Service}:latest"

gcloud config set project $Project
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

gcloud artifacts repositories create $Repo `
    --repository-format=docker `
    --location=$Region `
    --description="Attention Lab container images"

gcloud builds submit --tag $Image

gcloud run deploy $Service `
    --image $Image `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --port 8080 `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 5 `
    --set-env-vars "OPENAI_API_KEY=...,OPENAI_BASE_URL=...,AI_MODEL=..."
```

## Updating the deployed service

Re-run `.\deploy.ps1 -ProjectId <id>` — Cloud Build rebuilds the image with tag `:latest` and Cloud Run picks up the new revision automatically.

To change just the env vars without rebuilding:

```powershell
gcloud run services update attention-lab `
    --region us-central1 `
    --update-env-vars OPENAI_API_KEY=newkey,AI_MODEL=newmodel
```

## Notes & gotchas

- **Port:** Cloud Run injects `$PORT` (8080). The Dockerfile pre-sets `PORT=8080` and `HOSTNAME=0.0.0.0`, which the Next.js standalone `server.js` reads on startup.
- **Cold starts:** With `--min-instances 0` the first request after idle takes ~1–2s. Bump it to `--min-instances 1` if you want the demo to feel instant during judging — costs a few cents/day.
- **Region:** `us-central1` is the cheapest default. Pick one closest to your audience (e.g. `asia-south1` for India) to cut latency.
- **Auth:** `--allow-unauthenticated` makes the service publicly reachable, which is what you want for a demo.
- **Secrets:** For anything beyond a hackathon, swap `--set-env-vars` for Secret Manager via `--update-secrets OPENAI_API_KEY=openai-key:latest`.
