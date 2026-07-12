# GitHub Markdown Viewer

A web app for viewing GitHub-hosted Markdown files with full GFM rendering, syntax highlighting, and Mermaid diagram support. Optionally supports private repositories via GitHub App OAuth.

## Architecture

- **Frontend**: React + Vite + TypeScript SPA
- **Backend**: Plain PHP (no framework) handling OAuth and GitHub API proxying

## Prerequisites

- Node.js 22+
- pnpm
- PHP 8.2+ with `curl` extension (for backend/private repo support)
- A web server with PHP support (Apache/Nginx) for production, or PHP's built-in server for local dev

## Quick Start (Public Repos Only)

If you only need to view public repositories, no backend setup is required:

```bash
pnpm install
pnpm dev
```

The app will run at `http://localhost:5173` and can fetch any public GitHub markdown file.

## Full Setup (Private Repo Support)

To access private repositories, you need to set up the PHP backend with a GitHub App for OAuth.

### 1. Create a GitHub App

1. Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**
2. Fill in the form:
   - **GitHub App name**: anything you like (e.g., "My Markdown Viewer")
   - **Homepage URL**: your app's URL (e.g., `http://localhost:5173`)
   - **Callback URL**: your backend URL + `/api/auth/callback` (e.g., `http://localhost:8080/api/auth/callback`)
   - **Webhook**: uncheck "Active" (not needed)
   - **Permissions**:
     - Repository permissions → Contents: **Read-only**
   - **Where can this GitHub App be installed?**: "Only on this account" (or "Any account" if you want others to use it)
3. Click **Create GitHub App**
4. On the app settings page, note down:
   - **App ID** (top of the page)
   - **Client ID** (in the "About" section)
5. Click **Generate a new client secret** and copy it immediately

### 2. Configure the Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
GITHUB_APP_ID=123456
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxx
GITHUB_CLIENT_SECRET=your_client_secret_here
FRONTEND_URL=http://localhost:5173
```

> **Note**: `GITHUB_PRIVATE_KEY_PATH` is listed in `.env.example` but is **not currently used** by the backend. The current auth flow uses the standard OAuth code exchange with `client_id` and `client_secret` only. You can safely ignore or remove this line. It was reserved for a potential future feature (GitHub App installation tokens signed with a private key).

### 3. Start the Backend

Using PHP's built-in server for local development:

```bash
cd backend/public
php -S localhost:8080 router.php
```

The backend will be available at `http://localhost:8080`.

### 4. Configure the Frontend

Create a `.env` file in the project root:

```env
VITE_AUTH_BACKEND_URL=http://localhost:8080
```

### 5. Run the App

```bash
pnpm dev
```

Open `http://localhost:5173`. You should now see a login option that lets you authenticate via GitHub to access private repos.

> **Tip**: Even for public repos, authenticating raises your GitHub API rate limit from 60 to 5,000 requests/hour. If you hit a rate limit error, the app will show a "Connect GitHub" button to let you log in and continue browsing.

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the Vite dev server |
| `pnpm build` | Type-check and build for production |
| `pnpm preview` | Preview the production build locally |
| `pnpm test` | Run tests once |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Run ESLint |

## Deployment

A GitHub Actions workflow is included at `.github/workflows/deploy.yml`. It:

1. Builds the React frontend
2. Merges it with the PHP backend into a single `deploy/` directory
3. Pushes the result to a `deploy` branch

To use it:

1. Go to **Actions** tab in your GitHub repository
2. Select **"Push release to deploy branch"**
3. Click **"Run workflow"**

The `deploy` branch will contain a directory structure ready to upload to any PHP-capable shared host (e.g., Hostinger):

```
deploy/
├── public/           ← Document root (point your web server here)
│   ├── index.php     ← PHP entry point (routes /api/* requests)
│   ├── client/       ← Built React SPA assets
│   └── .htaccess     ← Apache rewrite rules
├── src/              ← PHP backend source
├── sessions/         ← Server-side session storage
└── states/           ← CSRF state storage
```

On your server, set the document root to the `public/` folder and ensure you have a `.env` file in the parent directory (one level above `public/`) with your production credentials.

## Environment Variables Reference

### Frontend (`.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_AUTH_BACKEND_URL` | No | Backend URL for private repo OAuth. If omitted, only public repos are accessible. |

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_APP_ID` | Yes | Your GitHub App's ID |
| `GITHUB_CLIENT_ID` | Yes | OAuth Client ID from the GitHub App |
| `GITHUB_CLIENT_SECRET` | Yes | OAuth Client Secret |
| `FRONTEND_URL` | No | Frontend origin for CORS (default: `http://localhost:5173`) |
| `GITHUB_PRIVATE_KEY_PATH` | No | **Not currently used.** Reserved for future GitHub App installation token signing. |
