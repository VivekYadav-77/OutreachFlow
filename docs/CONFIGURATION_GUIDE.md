# Configuration Guide

> **Who is this for?** Anyone setting up EmailSender for the first time. This guide explains every external service the project depends on — what it is, why we need it, and exactly how to get your credentials, step by step.

---

## Table of Contents

1. [PostgreSQL (Local Database)](#1-postgresql-local-database)
2. [Google Cloud / Gmail API / OAuth 2.0](#2-google-cloud--gmail-api--oauth-20)
3. [Google Gemini AI (Optional)](#3-google-gemini-ai-optional)

---

## 1. PostgreSQL (Local Database)

### What is PostgreSQL?

PostgreSQL (often called "Postgres") is a free, open-source database management system. Think of it like a very powerful, organized spreadsheet that runs as a background process on your computer. It stores data in tables with rows and columns, and applications talk to it using a language called SQL.

**Plain English:** It's the filing cabinet where EmailSender keeps all your contacts, emails, settings, logs, and send history.

### Why does this project need it?

EmailSender needs a place to permanently store:
- Your recruiter/contact list
- Email drafts, templates, and campaign configs
- The email send queue (what to send next)
- Send history, statistics, and logs
- Your Gmail OAuth tokens (so you don't have to reconnect every time)

All of this lives in PostgreSQL on your local machine.

### How to install PostgreSQL

#### Windows

1. Go to [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. Click **"Download the installer"** (provided by EDB).
3. Run the installer. Keep all default settings.
4. When asked to set a password for the `postgres` user — **write this password down**. You will need it.
5. Keep the default port: **5432**.
6. Finish the installation.

> **Tip:** The installer also installs **pgAdmin** — a graphical tool for managing your database. You can use it instead of the command line.

#### macOS

Using [Homebrew](https://brew.sh) (recommended):

```bash
brew install postgresql@16
brew services start postgresql@16
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Or download the graphical installer from [postgresapp.com](https://postgresapp.com/) — the easiest option for Mac.

#### Linux (Ubuntu / Debian)

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql   # auto-start on boot
```

### Creating the database

After installing PostgreSQL, you need to create the `email_sender` database.

#### Option A — Using the command line (`psql`)

```bash
# Connect to PostgreSQL as the postgres user
psql -U postgres
# (Enter your postgres password when prompted)

# Inside the psql prompt, create the database:
CREATE DATABASE email_sender;

# You should see: CREATE DATABASE

# Exit psql:
\q
```

#### Option B — Using pgAdmin (Windows / macOS graphical tool)

1. Open **pgAdmin** (search for it in your Start Menu or Applications folder).
2. In the left sidebar, expand **Servers** → right-click **PostgreSQL** → **Connect**.
3. Right-click **Databases** → **Create** → **Database**.
4. In the **Database** field, type: `email_sender`
5. Click **Save**.

### Building the connection string

The `DATABASE_URL` environment variable tells the backend where to find your database and how to log in.

**Format:**
```
postgres://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME
```

**For a standard local installation:**
```
postgres://postgres:YOUR_PASSWORD@localhost:5432/email_sender
```

Replace `YOUR_PASSWORD` with the password you set during PostgreSQL installation.

> **Example:** If your postgres password is `***REMOVED***`, the connection string is:
> ```
> postgres://postgres:***REMOVED***@localhost:5432/email_sender
> ```

Put this value in `server/.env`:
```env
DATABASE_URL=postgres://postgres:***REMOVED***@localhost:5432/email_sender
```

### Running migrations

Migrations create the database tables that EmailSender needs. Run this **once** after creating the database:

```bash
npm run db:migrate
```

### Common mistakes

| Mistake | Error message | Fix |
|---|---|---|
| PostgreSQL is not running | `connect ECONNREFUSED 127.0.0.1:5432` | Start the PostgreSQL service (see installation steps above) |
| Wrong password in connection string | `password authentication failed for user "postgres"` | Check the password in `server/.env` — it must match what you set during installation |
| Database was never created | `database "email_sender" does not exist` | Run `psql -U postgres -c "CREATE DATABASE email_sender;"` |
| Port mismatch | `connect ECONNREFUSED 127.0.0.1:5433` | Check the port — the default is 5432, not 5433 |
| Forgot to run migrations | Empty tables / app behaves oddly | Run `npm run db:migrate` |

### Verifying it works

After running `npm run dev`, open your browser at [http://localhost:4000/api/health](http://localhost:4000/api/health).

You should see:
```json
{ "ok": true }
```

If you see a database error instead, double-check your `DATABASE_URL`.

### Official documentation

- [PostgreSQL Downloads](https://www.postgresql.org/download/)
- [PostgreSQL Getting Started Guide](https://www.postgresql.org/docs/current/tutorial-start.html)
- [Connection String Format](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)

---

## 2. Google Cloud / Gmail API / OAuth 2.0

### What is Google Cloud?

Google Cloud is Google's platform for developers. It lets you access Google services (like Gmail, Maps, YouTube, etc.) programmatically through APIs.

**Plain English:** To send emails through someone's Gmail account using code, you need Google's permission. Getting that permission requires creating a free Google Cloud project and registering your application.

### What is OAuth 2.0?

OAuth 2.0 is a security standard that lets you grant an application access to your Google account **without sharing your password**. Instead of giving the app your Gmail password, you click "Allow" on Google's own login screen, and Google gives the app a secure token it can use on your behalf.

**Plain English:** The "Connect Google Account" button in the app's Settings page opens a Google login popup. Once you approve, Google sends back a token that lets the app send emails as you.

### Why does this project need it?

EmailSender sends emails directly through the Gmail API using your Gmail account. This is the official, secure, supported way to send Gmail — no passwords, no browser automation, no third-party SMTP servers.

The credentials you create (`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`) identify your application to Google. The OAuth flow connects your specific Gmail account to the app and stores a refresh token in the database.

### Step-by-step: Setting up Google Cloud credentials

> **Estimated time:** 10–15 minutes. A free Google account is all you need — no payment required.

---

#### Step 1 — Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Sign in with any Google account (it doesn't have to be the Gmail you'll use for sending).
3. At the top of the page, click the **project selector dropdown** (it might say "Select a project" or show an existing project name).
4. Click **"New Project"**.
5. Enter a project name, for example: `EmailSender`.
6. Click **"Create"**.
7. Wait a few seconds, then select the new project from the dropdown.

---

#### Step 2 — Enable the Gmail API

1. In the left sidebar, go to **APIs & Services** → **Library**.
2. In the search box, type: `Gmail API`
3. Click on **"Gmail API"** in the results.
4. Click the blue **"Enable"** button.
5. Wait for it to enable (it may take a few seconds).

---

#### Step 3 — Configure the OAuth Consent Screen

Before creating credentials, you must set up the "consent screen" — the page users see when they click "Connect Google Account."

1. In the left sidebar, go to **APIs & Services** → **OAuth consent screen**.
2. Choose **"External"** (this means any Google account can authorize it, not just accounts in a Google Workspace organization).
3. Click **"Create"**.
4. Fill in the required fields:
   - **App name:** `EmailSender` (or any name you like)
   - **User support email:** your email address
   - **Developer contact information:** your email address
5. Click **"Save and Continue"** through the **Scopes** and **Test users** sections — you don't need to change anything there.
6. On the **Summary** screen, click **"Back to Dashboard"**.

> **Note:** Your app will be in "Testing" mode. This is fine for personal use. It means only accounts you add as "Test users" can authorize the app. You can add your Gmail address under **OAuth consent screen** → **Test users** → **"+ Add users"**.

---

#### Step 4 — Create OAuth 2.0 credentials

1. In the left sidebar, go to **APIs & Services** → **Credentials**.
2. Click **"+ Create Credentials"** at the top.
3. Select **"OAuth client ID"**.
4. For **Application type**, select **"Web application"**.
5. Give it a name: `EmailSender Local`.
6. Under **"Authorized redirect URIs"**, click **"+ Add URI"** and enter exactly:
   ```
   http://localhost:4000/api/auth/callback
   ```
   > ⚠️ This must match **exactly** — including `http://` (not `https://`), `localhost`, port `4000`, and the path `/api/auth/callback`. Any difference will cause the OAuth flow to fail.
7. Click **"Create"**.

---

#### Step 5 — Copy your credentials

After creating the OAuth client, a dialog box appears showing:
- **Your Client ID** — a long string ending in `.apps.googleusercontent.com`
- **Your Client Secret** — a shorter string starting with `GOCSPX-`

Copy both values and paste them into `server/.env`:

```env
GOOGLE_CLIENT_ID=***REMOVED***
GOOGLE_CLIENT_SECRET=GOCSPX-your-actual-secret-here
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/callback
```

> **Can't find them later?** Go to **APIs & Services** → **Credentials**, click on the name of your OAuth client, and the Client ID and Secret are shown there.

---

#### Step 6 — Connect your Gmail account in the app

1. Start the app: `npm run dev`
2. Open [http://localhost:5173](http://localhost:5173)
3. Go to **Settings** (gear icon in the sidebar)
4. In the **"Google Account"** section, click **"Connect Google Account"**
5. You'll be redirected to Google's login page
6. Select the Gmail account you want to send from
7. If you see **"This app isn't verified"** — click **"Advanced"** → **"Go to EmailSender (unsafe)"**. This is normal for personal projects.
8. Click **"Allow"** to grant the Gmail send permission
9. You'll be redirected back to Settings, and it should now show **"Connected"** with your email address

### Common mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Gmail API not enabled | `Gmail API has not been used in project...` | Go to APIs & Services → Library → enable Gmail API |
| Wrong redirect URI | `redirect_uri_mismatch` error | The URI in Google Console must be exactly `http://localhost:4000/api/auth/callback` |
| App not in "External" mode | Can't sign in with your Google account | Set OAuth consent screen to "External" |
| Test user not added | `Access blocked: EmailSender has not completed the Google verification process` | Add your Gmail to the Test users list in OAuth consent screen settings |
| Credentials copied incorrectly | `invalid_client` error | Re-copy Client ID and Secret from Google Console — no extra spaces |
| Not restarting the server | Old config loaded | Always restart the backend (`Ctrl+C` then `npm run dev`) after changing `server/.env` |

### Verifying it works

After connecting, the **Settings** page should show:
```
Google Account: Connected ✓
Email: yourname@gmail.com
```

You can also check the connection status via the API:
```
http://localhost:4000/api/auth/status
```

### Official documentation

- [Google Cloud Console](https://console.cloud.google.com)
- [Gmail API documentation](https://developers.google.com/gmail/api)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes#gmail)

---

## 3. Google Gemini AI (Optional)

### What is Google Gemini?

Google Gemini is Google's family of large language models (AI). It can understand text and generate human-quality writing.

**Plain English:** Gemini is similar to ChatGPT but made by Google. In this project, it reads your resume and writes a personalized cover letter email for you.

### Why is this optional?

The Gmail sending, contact management, campaign, queue, and all other features work without Gemini. The only feature that requires a Gemini API key is the **Cover Letter Generator** page.

If you don't need AI-generated cover letters, you can skip this section entirely and leave `GEMINI_API_KEY` blank.

### Why does this project need it?

The Cover Letter Generator works like this:
1. You upload a PDF of your resume
2. You optionally specify a company, role, job description, and tone
3. The backend extracts the text from your PDF
4. It sends your resume text + your instructions to the Gemini API
5. Gemini returns a professionally written cover letter as HTML
6. The cover letter appears in the Compose editor, ready to send

### How to get a Gemini API key

> **Cost:** Free. Google AI Studio provides a free tier with generous limits, sufficient for personal cover letter generation.

---

#### Step 1 — Go to Google AI Studio

1. Visit [aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account (the same one you use for other Google services is fine)

---

#### Step 2 — Create an API key

1. Click **"Get API key"** in the left sidebar — or go directly to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click the blue **"Create API key"** button
3. Choose **"Create API key in new project"** (this creates a separate Google Cloud project just for the API key, which keeps things clean)
4. Your API key will be generated and displayed — it looks like: `AIzaSy...`

---

#### Step 3 — Copy the key to your environment file

Open `server/.env` and set:

```env
GEMINI_API_KEY=your-gemini-api-key-here
```

Optionally, you can also set the model name (the default is usually the best choice):

```env
GEMINI_MODEL_NAME=gemini-3.1-flash-lite
```

---

#### Step 4 — Restart the backend

After saving `server/.env`, restart the backend:
```bash
# Press Ctrl+C to stop, then:
npm run dev
```

### Understanding `GEMINI_MODEL_NAME`

The `GEMINI_MODEL_NAME` variable controls which Gemini model is used for generation. The default (`gemini-3.1-flash-lite`) is a fast, cost-efficient model that works well for cover letter generation.

You generally don't need to change this. If you want to experiment with a more capable model, you can change it to another available model — see the [Gemini model list](https://ai.google.dev/gemini-api/docs/models) for options.

### Common mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| API key not set or left as placeholder | `GEMINI_API_KEY is not configured` error in Cover Letter Generator | Add your real API key to `server/.env` |
| Copied key with extra spaces | `API_KEY_INVALID` error | Re-copy the key carefully from Google AI Studio |
| Didn't restart backend after adding key | Old configuration still loaded | Restart the backend (`Ctrl+C` then `npm run dev`) |
| Wrong model name | `models/xyz is not found` error | Use a valid model name from the [Gemini models page](https://ai.google.dev/gemini-api/docs/models) or remove `GEMINI_MODEL_NAME` to use the default |
| Free tier quota exceeded | `429 Resource has been exhausted` error | Wait a minute and try again, or check your quota at [aistudio.google.com](https://aistudio.google.com) |

### Verifying it works

1. Start the app: `npm run dev`
2. Go to **Cover Letter Generator** in the sidebar
3. Upload a PDF resume (or use any PDF file to test)
4. Fill in a target role and company
5. Click **"Generate Cover Letter"**
6. A cover letter should appear in the editor within a few seconds

If you see a red error message saying `GEMINI_API_KEY is not configured`, the key is not set correctly. Check `server/.env` and restart the backend.

### Official documentation

- [Google AI Studio](https://aistudio.google.com)
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Gemini API Quickstart](https://ai.google.dev/gemini-api/docs/quickstart)
- [Available Gemini Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini API Pricing & Free Tier](https://ai.google.dev/gemini-api/docs/pricing)
