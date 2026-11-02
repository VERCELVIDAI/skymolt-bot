# SkyMolt Bot - Deployment & Production Live Guide

Welcome to **SkyMolt Bot** — your self-hosted and cloud-ready AI agent platform for persistent teammates and autonomous computer use.

---

## Architecture Overview

SkyMolt Bot runs as a coordinated stack:
- **Web (`apps/web`)**: Modern React 19 + Vite frontend application.
- **API (`apps/api`)**: Hono + oRPC backend providing secure REST and RPC endpoints.
- **Worker (`apps/worker`)**: Graphile Worker handling asynchronous task execution, scheduled routines, and background jobs.
- **Database (`packages/db`)**: PostgreSQL with Prisma ORM and row-level security.
- **Sandboxes (`infra/sandboxes`)**: Docker / E2B / Daytona / Boat virtual computers where bots execute shell commands, browse the web, and interact with files.
- **Auth (`packages/auth`)**: Better Auth with email, password, and passkey support.

---

## Deployment Options

Choose the deployment method that fits your infrastructure best:

### Option 1: 1-Click Deploy on Railway (Recommended & Fastest)

Railway provides persistent PostgreSQL volumes and agent sandboxes out of the box with zero DevOps required.

1. **Push this repository to GitHub** under your organization or personal account:
   ```bash
   git init
   git add .
   git commit -m "feat: SkyMolt Bot rebranding and deployment configuration"
   git remote add origin https://github.com/<your-username>/skymolt-bot.git
   git branch -M main
   git push -u origin main
   ```
2. **Open Railway**:
   - Go to [Railway.com](https://railway.com) and create a New Project.
   - Choose **Deploy from GitHub repo** and select your `skymolt-bot` repository.
   - Railway will automatically detect `railway.json` and build using `Dockerfile`.
3. **Configure Environment Variables on Railway**:
   - `OWNER_EMAIL`: Your admin email address.
   - `RAILWAY_API_TOKEN`: Your Railway workspace API token (needed to provision sandbox environments).
   - Generate strong random keys for:
     - `BETTER_AUTH_SECRET`: Random 32+ character hex string.
     - `ENCRYPTION_KEY`: Random 64 character hex string.
     - `SCREEN_PROXY_SECRET`: Random 32+ character hex string.
4. **Deploy & Access**:
   - Click Deploy. Once healthy, Railway gives you a public HTTPS domain (e.g. `https://skymolt-production.up.railway.app`).
   - Copy `OWNER_PASSWORD` from the Variables tab and log in at your domain.

---

### Option 2: VPS / Dedicated Server with Docker Compose

Deploy on any Ubuntu, Debian, or Linux VPS (DigitalOcean, Hetzner, AWS EC2, GCP, Linode).

1. **SSH into your server and install Docker**:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
2. **Clone your repository**:
   ```bash
   git clone https://github.com/<your-username>/skymolt-bot.git
   cd skymolt-bot
   ```
3. **Generate your production `.env` configuration**:
   ```bash
   node scripts/generate-env.mjs
   ```
   This automatically generates unique, cryptographic secrets for:
   - `POSTGRES_PASSWORD` & `POSTGRES_APP_PASSWORD`
   - `BETTER_AUTH_SECRET`
   - `ENCRYPTION_KEY`
   - `SCREEN_PROXY_SECRET`
   - `SANDBOX_SUPERVISOR_TOKEN`
4. **Configure your domain**:
   In `.env`:
   ```env
   BETTER_AUTH_URL=https://your-domain.com
   WEB_ORIGIN=https://your-domain.com
   API_URL=https://your-domain.com/api
   ```
5. **Start SkyMolt Bot**:
   ```bash
   docker compose up -d --build
   ```
6. **Set up Reverse Proxy & SSL (Caddy or Nginx)**:
   Point your domain to `127.0.0.1:5173`. With Caddy:
   ```caddyfile
   your-domain.com {
       reverse_proxy 127.0.0.1:5173
   }
   ```

---

### Option 3: Deploy on Render

Use the bundled `render.yaml` blueprint:

1. Push your repository to GitHub.
2. In Render Dashboard, click **New +** -> **Blueprint**.
3. Connect your repository. Render will automatically configure the `skymolt-bot` web service and `skymolt-db` PostgreSQL instance.
4. Provide your `OWNER_EMAIL` and deploy.

---

## Connecting AI Models

Once SkyMolt Bot is running:
1. Open your live SkyMolt Bot web interface.
2. Sign in with your owner credentials.
3. Go to **Settings** -> **Models**.
4. Choose any provider of your choice:
   - **OpenAI** (GPT-4o, GPT-4.5)
   - **Anthropic** (Claude 3.7 Sonnet, Claude 3.5 Haiku)
   - **Google Gemini** (Gemini 2.5 Flash / Pro, Gemini 3.8)
   - **OpenRouter** (Unified access to all models)
   - **Ollama / Local Models** (Self-hosted local models)

---

## Verifying the Deployment

Run healthchecks to ensure all services are operating smoothly:
- Web interface: `http://localhost:5173` (or your domain)
- API health probe: `http://localhost:3100/ready` (returns HTTP 200)
- Sandboxes: Run a test prompt asking Chief to check disk space or browse a web page.
