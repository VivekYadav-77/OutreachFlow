# 📬 EmailSender — Local Gmail Outreach Automation

<p align="center">
  <img src="./client/public/favicon.svg" width="128" alt="EmailSender Logo" />
</p>

> A production-minded, single-user local application for legitimate personalized email outreach through the **official Gmail API**. Manage recruiter contacts, compose rich-text emails, run automated sending campaigns, and generate AI-powered cover letters — all from your own machine, using your own Gmail account.

---

## Table of Contents

1. [What is this?](#1-what-is-this)
2. [Features](#2-features)
3. [Architecture Overview](#3-architecture-overview)
4. [Tech Stack](#4-tech-stack)
5. [Folder Structure](#5-folder-structure)
6. [Prerequisites](#6-prerequisites)
7. [Installation](#7-installation)
8. [Environment Setup](#8-environment-setup)
9. [Database Setup](#9-database-setup)
10. [Running the Application](#10-running-the-application)
11. [Build for Production](#11-build-for-production)
12. [Common Commands](#12-common-commands)
13. [Features Deep-Dive](#13-features-deep-dive)
14. [Google OAuth Setup](#14-google-oauth-setup)
15. [Gemini AI Setup (Optional)](#15-gemini-ai-setup-optional)
16. [Troubleshooting](#16-troubleshooting)
17. [FAQ](#17-faq)
18. [Security Notes](#18-security-notes)
19. [Contributing](#19-contributing)
20. [License](#20-license)

---

## 1. What is this?

**EmailSender** is a self-hosted web application that runs entirely on your own computer. It acts as a personal email campaign manager — you connect it to your Gmail account once, and it can send personalized outreach emails on your behalf through Google's official API.

Think of it as a lightweight, privacy-first alternative to tools like Mailchimp or Hunter.io — but designed for personal use, running locally, and using only your own Gmail account. No data is ever sent to a third-party email service.

**Who is it for?** Developers, job seekers, freelancers, or anyone who wants to send personalized bulk emails without relying on a cloud SaaS tool.

**What does "local" mean?** Everything runs on your machine — the web server, the database, the file storage. Nothing is deployed to the cloud unless you choose to do so yourself.

---

## 2. Features

- **Recruiter/Contact Management** — Add, edit, and organize contacts manually or by importing a CSV or Excel file. Track outreach status per contact (`Pending`, `Sent`, `Replied`, `Failed`, `Skipped`).
- **Rich-Text Email Composer** — Write emails with a full WYSIWYG editor (bold, italic, links, images, headings, lists). Supports CC, BCC, and file attachments.
- **Email Templates** — Create reusable email templates with Handlebars-style placeholders (`{{fullName}}`, `{{company}}`, `{{designation}}`) that get personalized for each recipient automatically.
- **Campaign Management** — Group contacts into campaigns with custom sending windows, daily limits, and retry logic.
- **Automated Send Queue** — Queue emails for background delivery. A built-in worker picks up jobs, respects your configured working hours and daily send limits, and retries on transient failures.
- **AI Cover Letter Generator** — Upload your resume (PDF) and let Google Gemini AI generate a personalized cover letter email. Supports custom tone, target role, company, job description, and skill focus.
- **Statistics Dashboard** — Visual charts showing daily sent/failed email counts over time.
- **Application Logs** — Filterable log viewer showing every send event, error, and system action.
- **Settings Panel** — Control the worker (start/pause/stop), configure daily limits, sending delays, working hours, and retry intervals. Connect/disconnect your Google account from here.
- **Dark/Light Theme** — Full theme switcher with preference persistence.

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Your Computer                             │
│                                                                  │
│  ┌──────────────────┐        ┌───────────────────────────────┐  │
│  │   Browser         │◄──────►│  Backend (Express, Port 4000) │  │
│  │   React + Vite   │  HTTP  │                               │  │
│  │   Port 5173       │        │  ┌─────────────────────────┐ │  │
│  └──────────────────┘        │  │  Scheduler (node-cron)  │ │  │
│                               │  │  Email Worker (async)   │ │  │
│                               │  └─────────────────────────┘ │  │
│                               │               │               │  │
│                               │  ┌────────────▼────────────┐ │  │
│                               │  │  PostgreSQL (local)     │ │  │
│                               │  └─────────────────────────┘ │  │
│                               └───────────────────────────────┘  │
│                                               │                   │
└───────────────────────────────────────────────┼───────────────────┘
                                                │ Gmail API (HTTPS)
                                    ┌───────────▼──────────────┐
                                    │   Google Cloud           │
                                    │   Gmail API v1           │
                                    │   OAuth 2.0              │
                                    └──────────────────────────┘
```

**How sending works:**
1. You compose an email and click "Queue for Sending."
2. The job is saved to the `email_queue` table in PostgreSQL.
3. The background `EmailWorker` picks up the job every minute (via `node-cron`).
4. It checks working hours, daily limits, and waits a random delay between sends.
5. It calls the Gmail API to send the message.
6. Success/failure is recorded in the database and the log viewer.

---

## 4. Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 7 | Dev server & bundler |
| React Router DOM | 7 | Client-side routing |
| Tiptap | 3 | Rich-text email editor |
| Recharts | 3 | Statistics charts |
| Lucide React | — | Icons |
| Vanilla CSS | — | All styling (custom design system) |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 22+ | Runtime |
| TypeScript | 5 | Type safety |
| Express | 5 | HTTP server |
| Drizzle ORM | — | Database access & migrations |
| `pg` | — | PostgreSQL driver |
| `googleapis` | — | Gmail API & OAuth 2.0 |
| `@google/generative-ai` | — | Gemini AI (cover letters) |
| `handlebars` | — | Email template rendering |
| `multer` | — | File upload handling |
| `pdf-parse` | — | PDF text extraction |
| `@fast-csv` | — | CSV import/export |
| `xlsx` | — | Excel recruiter import |
| `pino` | — | Structured logging |
| `node-cron` | — | Background job scheduler |
| `zod` | — | Environment variable validation |
| `vitest` | — | Test runner |

### Database
| Technology | Purpose |
|---|---|
| PostgreSQL 14+ | Primary data store (contacts, campaigns, queue, logs, settings) |
| Drizzle Kit | Schema management & migrations |

---

## 5. Folder Structure

```
EmailSender/
├── .env.example              # Environment variable template → copy to server/.env
├── .gitignore                # Git ignore rules
├── package.json              # Root workspace config (npm workspaces)
├── README.md                 # This file
├── testing_recruiters.csv    # Sample CSV for testing recruiter import
│
├── docs/                     # Documentation
│   ├── CONFIGURATION_GUIDE.md    # Step-by-step guide for every external service
│   └── ENVIRONMENT_VARIABLES.md  # Complete env var reference
│
├── client/                   # React frontend
│   ├── index.html            # HTML entry point
│   ├── vite.config.ts        # Vite configuration
│   ├── tsconfig.json         # TypeScript configuration
│   └── src/
│       ├── main.tsx          # App entry point
│       ├── styles.css        # Global styles & design tokens
│       ├── api/              # API client functions
│       ├── components/       # Shared UI components (Shell, Toast, etc.)
│       ├── context/          # React context providers (Theme, Toast)
│       ├── pages/            # Full-page views (Dashboard, Recruiters, etc.)
│       └── types/            # TypeScript type definitions
│
└── server/                   # Express backend
    ├── .env                  # Your real environment variables (git-ignored)
    ├── drizzle.config.ts     # Drizzle ORM configuration
    ├── vitest.config.ts      # Test configuration
    ├── tsconfig.json         # TypeScript configuration
    ├── drizzle/              # Auto-generated SQL migration files
    ├── uploads/              # Uploaded files (resumes, attachments) — git-ignored
    ├── logs/                 # Application log files — git-ignored
    └── src/
        ├── index.ts          # Server entry point (starts server + scheduler)
        ├── app.ts            # Express app setup (routes, CORS, middleware)
        ├── config.ts         # Environment variable parsing & validation (Zod)
        ├── auth/             # Google OAuth helper
        ├── database/         # Schema (Drizzle), DB client, seed
        ├── gmail/            # Gmail API service
        ├── middleware/       # Request logger, error handler, input validation
        ├── providers/        # Email provider abstraction (Gmail implementation)
        ├── queue/            # Email queue service (claim jobs, retry logic)
        ├── routes/           # All Express route handlers (11 route files)
        ├── scheduler/        # node-cron scheduler (fires every minute)
        ├── services/         # Business logic layer (10 service files)
        ├── utils/            # Logger, custom error classes
        └── workers/          # Async email send worker loop
```

---

## 6. Prerequisites

You need to install the following software before you can run this project. Each item links to the official download page.

> **New to development?** Work through this list from top to bottom. Each item has instructions for Windows, macOS, and Linux.

### 1 — Node.js (v22 or newer)

Node.js is the JavaScript runtime that powers the backend server.

- **Windows / macOS**: Download the installer from [nodejs.org/en/download](https://nodejs.org/en/download). Choose the **LTS** version (22.x).
- **macOS (Homebrew)**: `brew install node`
- **Linux (Ubuntu/Debian)**:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```

Verify installation:
```bash
node --version   # should print v22.x.x or higher
npm --version    # should print 10.x.x or higher
```

### 2 — PostgreSQL (v14 or newer)

PostgreSQL is the database that stores all your contacts, emails, settings, and logs.

- **Windows**: Download from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/). Run the graphical installer. **Remember the password you set for the `postgres` user** — you'll need it later.
- **macOS (Homebrew)**: `brew install postgresql@16 && brew services start postgresql@16`
- **Linux (Ubuntu/Debian)**:
  ```bash
  sudo apt update && sudo apt install -y postgresql postgresql-contrib
  sudo systemctl start postgresql
  ```

Verify installation:
```bash
psql --version   # should print psql (PostgreSQL) 14.x or higher
```

### 3 — Git

Git is used to download (clone) this project.

- **Windows**: Download from [git-scm.com/download/win](https://git-scm.com/download/win)
- **macOS**: `brew install git` or it comes pre-installed with Xcode Command Line Tools
- **Linux**: `sudo apt install git`

Verify: `git --version`

### 4 — A Google Account

You need a Google account (Gmail) to connect the app. You will also need to create a free Google Cloud project to get API credentials. Instructions are in [Section 14 — Google OAuth Setup](#14-google-oauth-setup).

---

## 7. Installation

### Step 1 — Clone the repository

Open a terminal (Command Prompt, PowerShell, or Terminal) and run:

```bash
git clone https://github.com/your-username/EmailSender.git
cd EmailSender
```

> **Don't have a GitHub URL?** If you received the project as a ZIP file, extract it and open a terminal in the extracted folder.

### Step 2 — Install all dependencies

This project uses **npm workspaces**, which means one command installs packages for both the frontend and backend:

```bash
npm install
```

This may take a minute. You should see it create `node_modules/` folders inside `client/`, `server/`, and the root.

### Step 3 — Create your environment file

```bash
# Windows (Command Prompt)
copy .env.example server\.env

# Windows (PowerShell)
Copy-Item .env.example server\.env

# macOS / Linux
cp .env.example server/.env
```

Now open `server/.env` in a text editor and fill in your real values. See [Section 8 — Environment Setup](#8-environment-setup) for details.

### Step 4 — Set up the database

See [Section 9 — Database Setup](#9-database-setup).

### Step 5 — Run the app

```bash
npm run dev
```

Open your browser at **http://localhost:5173**.

---

## 8. Environment Setup

All configuration is done through environment variables in the `server/.env` file. This file is never committed to Git (it's in `.gitignore`).

Open `server/.env` and fill in the following values:

```env
# Required — your PostgreSQL connection string
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/email_sender

# Required for Gmail sending — from Google Cloud Console
GOOGLE_CLIENT_ID=yourcredentials
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret-here
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/callback

# Optional — only needed for AI Cover Letter Generator
GEMINI_API_KEY=[GCP_API_KEY]

# Optional — these have sensible defaults
PORT=4000
CLIENT_URL=http://localhost:5173
LOG_LEVEL=info
GEMINI_MODEL_NAME=gemini-3.1-flash-lite
```

For a full explanation of every variable, see [`docs/ENVIRONMENT_VARIABLES.md`](docs/ENVIRONMENT_VARIABLES.md).

For step-by-step instructions on getting the Google credentials, see [`docs/CONFIGURATION_GUIDE.md`](docs/CONFIGURATION_GUIDE.md).

---

## 9. Database Setup

### Step 1 — Create the database

Connect to PostgreSQL and create a new database named `email_sender`.

**Option A — Using the `psql` command line:**

```bash
# Connect to PostgreSQL (enter your postgres password when prompted)
psql -U postgres

# Inside the psql shell, run:
CREATE DATABASE email_sender;

# Exit psql:
\q
```

**Option B — Using pgAdmin (graphical tool):**

1. Open pgAdmin (installed with PostgreSQL on Windows).
2. Right-click on "Databases" → "Create" → "Database".
3. Enter `email_sender` as the name and click Save.

### Step 2 — Update your connection string

Make sure `DATABASE_URL` in `server/.env` matches your database:

```
DATABASE_URL=postgres://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/email_sender
```

Replace `YOUR_POSTGRES_PASSWORD` with the password you set when installing PostgreSQL.

### Step 3 — Run migrations

Migrations create all the required database tables automatically:

```bash
npm run db:migrate
```

You should see output like:
```
Applying migration 0000_melodic_hardball.sql...
Applying migration 0001_familiar_vargas.sql...
✓ Migrations applied successfully
```

> **What is a migration?** A migration is a script that creates or modifies database tables. You only need to run this once when setting up, and again whenever the project is updated with new migrations.

---

## 10. Running the Application

### Run everything together (recommended for development)

```bash
npm run dev
```

This starts both the frontend and backend simultaneously using `concurrently`.

| Service | URL |
|---|---|
| Frontend (React UI) | http://localhost:5173 |
| Backend (API) | http://localhost:4000 |
| Health check | http://localhost:4000/api/health |

### Run only the backend

```bash
npm run dev --workspace server
```

### Run only the frontend

```bash
npm run dev --workspace client
```

### View the API database with Drizzle Studio

```bash
npm run db:studio --workspace server
```

This opens a visual browser-based database viewer at `https://local.drizzle.studio`.

---

## 11. Build for Production

> **Note:** This project is designed for local use and does not require a production build for normal operation. Use this only if you are deploying to a server.

### Build both frontend and backend

```bash
npm run build
```

### Start the production server (after building)

```bash
npm run start --workspace server
```

The backend will serve from `server/dist/index.js`. The frontend build output is in `client/dist/` and can be served by any static file host (Nginx, Caddy, etc.) or the Express server can be extended to serve it.

---

## 12. Common Commands

| Command | Description |
|---|---|
| `npm install` | Install all dependencies (run once after cloning) |
| `npm run dev` | Start frontend + backend in development mode |
| `npm run dev --workspace server` | Start backend only |
| `npm run dev --workspace client` | Start frontend only |
| `npm run build` | Build both frontend and backend for production |
| `npm run start --workspace server` | Start backend in production mode |
| `npm run db:migrate` | Apply pending database migrations |
| `npm run db:generate` | Generate a new migration from schema changes |
| `npm run db:studio --workspace server` | Open visual database browser |
| `npm test` | Run the backend test suite |

---

## 13. Features Deep-Dive

### Dashboard

The main overview page. Shows:
- Today's send count vs. your daily limit
- Queue status (pending, sending, failed jobs)
- Worker controls: **Start**, **Pause**, **Stop**
- Recent send activity

### Recruiters

Manage your contacts here. You can:
- Add contacts one by one with a form
- Import a CSV or Excel file with common headers like `Name`, `Title`, `Company`, and `Email`
- Export your contacts to CSV
- View per-contact send status
- Filter by status (`Pending`, `Sent`, `Replied`, etc.)

### Compose

Write and queue emails for sending. Features:
- Full rich-text editor (bold, italic, headings, links, lists, text color, highlights)
- Template picker — choose an email template and auto-fill recipient details
- File attachments (resume, documents)
- CC and BCC fields
- Preview before sending
- "Queue for Sending" — adds the email to the background send queue

### Email Templates

Create reusable email templates. Use Handlebars placeholders:

| Placeholder | Replaced with |
|---|---|
| `{{fullName}}` | Recipient's full name |
| `{{company}}` | Recipient's company |
| `{{designation}}` | Recipient's job title |

### Cover Letter Generator

Upload a PDF of your resume and let **Google Gemini AI** write a personalized cover letter email. You can specify:
- Target company and role (or leave blank for a general template)
- Tone (professional, casual, enthusiastic, etc.)
- Job description for extra context
- Specific skills to highlight

> **Requires `GEMINI_API_KEY`** in your `server/.env`. See [Section 15](#15-gemini-ai-setup-optional).

### Statistics

Interactive charts (line + bar) showing your daily send and failure history over time. Helps you track campaign performance.

### Logs

A real-time event log of every action the worker and system takes. Filterable by log level (`info`, `warn`, `error`). Useful for debugging failed sends.

### Settings

Configure the application:
- **Google Account**: Connect or disconnect your Gmail account via OAuth
- **Worker Controls**: Start/pause/stop the background email sender
- **Daily Limit**: Maximum emails to send per day
- **Sending Delays**: Min/max delay (in seconds) between emails
- **Working Hours**: The time window when the worker is allowed to send
- **Retry Settings**: Number of retry attempts and intervals for failed sends
- **Attachments**: Toggle whether to include attachments in campaign emails

---

## 14. Google OAuth Setup

To send emails, you must connect the app to your Google account. This requires creating a free **Google Cloud project** and enabling the **Gmail API**.

For a complete beginner-friendly walkthrough with screenshots, see:

📖 **[docs/CONFIGURATION_GUIDE.md → Section 2: Google Cloud / Gmail API](docs/CONFIGURATION_GUIDE.md#2-google-cloud--gmail-api--oauth-20)**

**Quick summary:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project
3. Enable the **Gmail API**
4. Create **OAuth 2.0 credentials** (Desktop or Web application type)
5. Add `http://localhost:4000/api/auth/callback` as an authorized redirect URI
6. Copy the **Client ID** and **Client Secret** to `server/.env`
7. Restart the backend
8. Go to **Settings** in the app → click **Connect Google Account**

---

## 15. Gemini AI Setup (Optional)

The Cover Letter Generator requires a free API key from **Google AI Studio**.

For a complete walkthrough, see:

📖 **[docs/CONFIGURATION_GUIDE.md → Section 3: Google Gemini AI](docs/CONFIGURATION_GUIDE.md#3-google-gemini-ai-optional)**

**Quick summary:**
1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API key**
4. Copy the key to `server/.env` as `GEMINI_API_KEY`
5. Restart the backend

---

## 16. Troubleshooting

### ❌ `Invalid environment configuration: DATABASE_URL: ...`

**Cause:** The `server/.env` file is missing or `DATABASE_URL` is not set correctly.

**Fix:**
1. Confirm `server/.env` exists (not just `.env.example`)
2. Check the `DATABASE_URL` format: `postgres://USER:PASSWORD@HOST:PORT/DATABASE`
3. Make sure there are no extra spaces or quotes in the value

---

### ❌ `ECONNREFUSED 127.0.0.1:5432` or `connect ECONNREFUSED`

**Cause:** PostgreSQL is not running.

**Fix:**
- **Windows:** Open the Services panel (`services.msc`) and start the PostgreSQL service.
- **macOS:** `brew services start postgresql@16`
- **Linux:** `sudo systemctl start postgresql`

---

### ❌ `database "email_sender" does not exist`

**Cause:** The database was not created yet.

**Fix:** Run the following in your terminal:
```bash
psql -U postgres -c "CREATE DATABASE email_sender;"
```

---

### ❌ `Google OAuth environment variables are not configured`

**Cause:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_REDIRECT_URI` are missing from `server/.env`.

**Fix:** Follow [Section 14](#14-google-oauth-setup) to set up Google credentials, then restart the backend.

---

### ❌ `GEMINI_API_KEY is not configured`

**Cause:** You tried to use the Cover Letter Generator without setting up a Gemini API key.

**Fix:** Follow [Section 15](#15-gemini-ai-setup-optional) to get a free API key.

---

### ❌ Emails not sending — worker appears stuck

**Cause:** Several possible causes:
- Worker is not started (go to Settings → Start Worker)
- Current time is outside your configured working hours
- Daily send limit reached (resets at midnight)
- Queue is empty

**Fix:** Check the **Logs** page for specific error messages. Check the **Dashboard** for worker status and today's send count.

---

### ❌ `Cannot find module` errors on startup

**Cause:** Dependencies were not installed.

**Fix:** Run `npm install` from the project root.

---

### ❌ Port 5173 or 4000 already in use

**Cause:** Another process is using the port.

**Fix:**
- **Windows:** `netstat -ano | findstr :4000` then `taskkill /PID <pid> /F`
- **macOS/Linux:** `lsof -ti:4000 | xargs kill`

Or change the port in `server/.env` (`PORT=4001`) and restart.

---

## 17. FAQ

**Q: Is this safe to use? Will my Gmail account get banned?**

A: This application uses the official Gmail API with OAuth 2.0 — the same method used by Gmail apps like Thunderbird. Google allows legitimate use of this API for automated sending. The app enforces configurable daily limits and delays between sends to keep usage reasonable. It does not use browser automation, passwords, or any scraping. That said, sending large volumes of cold emails is against Google's Terms of Service — use this responsibly.

---

**Q: Do I need to pay for anything?**

A: No. PostgreSQL is free and open-source. The Gmail API has a free sending quota. Google AI Studio (Gemini) has a free tier sufficient for typical cover letter generation. The only potential cost is if you deploy this to a cloud server, but local use is completely free.

---

**Q: My recruiter's name doesn't appear in the email — it shows `{{fullName}}` literally.**

A: This means the template placeholder wasn't replaced. Make sure the recruiter has a `Full Name` set in the Recruiters page, and that the template uses the exact placeholder `{{fullName}}` (case-sensitive, double curly braces).

---

**Q: How do I import recruiters from a spreadsheet?**

A: Upload a CSV, `.xlsx`, or `.xls` file directly from the Recruiters page. The first row should contain column headers, and each contact should be one row below it.

Required attributes:

| Attribute | Accepted column headers | Description |
|---|---|---|
| `fullName` | `fullName`, `Full Name`, `Name`, `Contact Name`, `HR Name` | Recruiter/contact person's name |
| `company` | `company`, `Company`, `Company Name`, `Organization`, `Organisation` | Company name |
| `email` | `email`, `Email`, `Email ID`, `Email Address`, `Mail`, `Mail ID` | Recruiter's email address |

Optional attributes:

| Attribute | Accepted column headers | Description |
|---|---|---|
| `designation` | `designation`, `Designation`, `Title`, `Job Title`, `Role`, `Position` | Job title or role |
| `linkedin` | `linkedin`, `LinkedIn`, `LinkedIn URL`, `Profile`, `LinkedIn Profile` | LinkedIn/profile URL |
| `notes` | `notes`, `Notes`, `Remarks`, `Comments`, `Category` | Extra context; `Category` is used as notes when no notes column exists |

Example structure:

| Name | Title | Company | Category | Email |
|---|---|---|---|---|
| Reena Vijayanand | Head HR - Data Center | AdaniConneX | MNC / Product Companies | reena.v@adani.com |

---

**Q: Can I run this on a remote server so it sends emails even when my computer is off?**

A: Yes — you can deploy the backend to any Node.js-capable host (e.g. a cheap VPS running Ubuntu). You will need to set up PostgreSQL on the server and configure the environment variables there. See [Section 11 — Build for Production](#11-build-for-production).

---

**Q: The Google Auth page says "This app isn't verified."**

A: Because this is your own private Google Cloud project (not a published commercial app), Google shows this warning. Click **"Advanced"** → **"Go to [app name] (unsafe)"** to proceed. This is normal and safe for your own project.

---

**Q: How do I reset the database and start fresh?**

A: Run the following in your terminal (this **deletes all data**):
```bash
psql -U postgres -c "DROP DATABASE email_sender;"
psql -U postgres -c "CREATE DATABASE email_sender;"
npm run db:migrate
```

---

**Q: Can I use this with a Gmail account that has 2-Factor Authentication?**

A: Yes — OAuth 2.0 does not use your password at all. 2FA does not affect the app's ability to send emails through the API.

---

## 18. Security Notes

- **Data is local:** All data (contacts, emails, credentials, logs) is stored only on your machine in the local PostgreSQL database. Nothing is sent to any third-party service except Google's own APIs.
- **OAuth scopes:** The app requests only the minimum required Gmail scope: `gmail.send` (send email on your behalf) and `userinfo.email` (display your email address in Settings). It cannot read, delete, or modify your emails.
- **Never commit `server/.env`:** Your `server/.env` file contains sensitive credentials (Google Client Secret, Gemini API Key). This file is listed in `.gitignore`. Never share it or commit it to version control.
- **Local network only:** In development mode, the backend binds to `localhost:4000` and only accepts requests from the configured `CLIENT_URL`. Do not expose port 4000 directly to the internet without adding authentication.
- **Rate limits:** The Gmail API has sending quotas. The app's daily limit and delay settings help stay within acceptable usage. Do not set a daily limit above 500 emails per day on a personal Gmail account.
- **Compliance:** This tool is for personal legitimate outreach only. Do not use it to send spam. Comply with your local laws regarding email marketing (e.g. CAN-SPAM, GDPR).

---

## 19. Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository on GitHub.
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/EmailSender.git`
3. **Create a branch** for your change: `git checkout -b feature/my-new-feature`
4. **Make your changes** and test them locally.
5. **Run the tests**: `npm test`
6. **Commit** with a descriptive message: `git commit -m "feat: add CSV export for logs"`
7. **Push** to your fork: `git push origin feature/my-new-feature`
8. **Open a Pull Request** on GitHub with a clear description of what you changed and why.

### Guidelines
- Keep pull requests focused — one feature or fix per PR.
- Follow the existing code style (TypeScript, ESM modules).
- Add or update tests for any new functionality.
- Do not commit `server/.env`, `node_modules/`, or build artifacts.

---

## 20. License

This project is licensed under the **MIT License**.

You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of this software, provided that the above copyright notice and this permission notice appear in all copies.

**This software is provided "as is", without warranty of any kind.** The authors are not responsible for any Gmail account suspension, data loss, or other damages resulting from use of this software. Use responsibly and in compliance with Google's Terms of Service.

---

*Built with ❤️ using React, Express, PostgreSQL, and the Gmail API.*
