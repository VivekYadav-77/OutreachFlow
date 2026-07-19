# Environment Variables Reference

> This document explains every environment variable used by Outreach Flow, what it controls, whether it is required, and how to set it correctly.

---

## What are environment variables?

Environment variables are configuration settings that live **outside your code** in a plain text file. This is the standard way to configure software without hardcoding sensitive values like passwords and API keys directly into source files.

In this project, environment variables live in `server/.env`. This file:
- Is **never committed to Git** (listed in `.gitignore`)
- Must be created manually by copying `.env.example`
- Is read by the backend server at startup

**How to create the file:**
```bash
# Windows (Command Prompt)
copy .env.example server\.env

# Windows (PowerShell)
Copy-Item .env.example server\.env

# macOS / Linux
cp .env.example server/.env
```

Then open `server/.env` in any text editor and fill in your real values.

---

## Quick Reference Table

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ **Required** | — | PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | ⚠️ For Gmail sending | — | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | ⚠️ For Gmail sending | — | Google OAuth 2.0 Client Secret |
| `GOOGLE_REDIRECT_URI` | ⚠️ For Gmail sending | — | OAuth callback URL |
| `PORT` | Optional | `4000` | Backend server port |
| `CLIENT_URL` | Optional | `http://localhost:5173` | Frontend URL (used for CORS) |
| `LOG_LEVEL` | Optional | `info` | Logging verbosity |
| `TOKEN_ENCRYPTION_KEY` | Optional | — | Stable secret used to encrypt stored Google refresh tokens |
| `GEMINI_API_KEY` | ⚠️ For AI cover letters | — | Google Gemini AI API key |
| `GEMINI_MODEL_NAME` | Optional | `gemini-3.1-flash-lite` | Gemini model name |

**Legend:**
- ✅ **Required** — the server will refuse to start without this
- ⚠️ **For feature X** — optional at startup but required for specific functionality
- **Optional** — has a sensible default, can be left unset

---

## Detailed Variable Reference

---

### `DATABASE_URL`

**Required: Yes** — the server will not start without this.

**What it does:**
Tells the backend how to connect to your local PostgreSQL database. This single string contains the username, password, host, port, and database name.

**Format:**
```
postgres://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME
```

**Example value:**
```env
DATABASE_URL=postgres://postgres:yourcredentials@localhost:5432/email_sender
```

**Where to get it:**
You construct this string yourself based on your PostgreSQL installation. The default PostgreSQL port is `5432`, the default superuser is `postgres`, and the database name is `email_sender` (which you create manually — see the main README or `docs/CONFIGURATION_GUIDE.md`).

**What happens if it's wrong:**
- Missing entirely: the server throws `Invalid environment configuration: DATABASE_URL: String must contain at least 1 character` and exits immediately.
- Wrong password: `password authentication failed for user "postgres"` when the server tries to connect.
- Database doesn't exist: `database "email_sender" does not exist`.
- PostgreSQL not running: `connect ECONNREFUSED 127.0.0.1:5432`.

**Security note:** Contains your database password. Never share or commit this file.

---

### `GOOGLE_CLIENT_ID`

**Required: No** (at startup) **— Yes** (to send emails via Gmail)

**What it does:**
Identifies your Google Cloud application to Google's OAuth 2.0 system. The app uses this along with `GOOGLE_CLIENT_SECRET` to build the Google login URL and exchange authorization codes for access tokens.

Without this, the "Connect Google Account" button in Settings will not work, and the app will run in a read-only mode (you can manage contacts and templates, but cannot send emails).

**Format:**
A long string ending in `.apps.googleusercontent.com`

**Example value:**
```env
GOOGLE_CLIENT_ID=yourcredentials
```

**Where to get it:**
[Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Your OAuth 2.0 Client.

See full instructions: [`docs/CONFIGURATION_GUIDE.md` → Section 2](CONFIGURATION_GUIDE.md#2-google-cloud--gmail-api--oauth-20)

**What happens if it's wrong or missing:**
- If all three Google variables are missing, the app starts but shows a warning in Settings.
- If set to an incorrect value: `invalid_client` error during the OAuth flow.

---

### `GOOGLE_CLIENT_SECRET`

**Required: No** (at startup) **— Yes** (to send emails via Gmail)

**What it does:**
The private secret that proves your application is who it claims to be. Used alongside `GOOGLE_CLIENT_ID` during the OAuth token exchange.

**Format:**
A shorter string, usually starting with `GOCSPX-`

**Example value:**
```env
GOOGLE_CLIENT_SECRET=GOCSPX-your-actual-secret-here
```

**Where to get it:**
Same place as `GOOGLE_CLIENT_ID` — Google Cloud Console → Credentials → Your OAuth client.

**Security note:** This is a sensitive secret. Never expose it publicly. Never put it in client-side code or commit it to version control.

**What happens if it's wrong:**
- `invalid_client` during the OAuth callback.
- Token exchange fails silently and you're redirected to Settings without a "Connected" status.

---

### `GOOGLE_REDIRECT_URI`

**Required: No** (at startup) **— Yes** (to send emails via Gmail)

**What it does:**
The URL that Google redirects to after you approve the OAuth consent screen. The backend receives the authorization code at this URL and exchanges it for tokens.

This value must be **registered exactly** in Google Cloud Console as an authorized redirect URI. If the value in `server/.env` does not exactly match what's registered in Google Cloud, the OAuth flow will fail with a `redirect_uri_mismatch` error.

**Value (do not change this in development):**
```env
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/callback
```

**What happens if it's wrong:**
- `Error 400: redirect_uri_mismatch` — Google will refuse the OAuth flow and show an error page.
- Fix: make sure the value in `server/.env` matches **exactly** what you registered in Google Cloud Console (same scheme, host, port, and path).

**Note:** If you change `PORT`, you must also update this value and re-register the new URI in Google Cloud Console.

---

### `PORT`

**Required: No**

**Default:** `4000`

**What it does:**
Sets the port number that the Express backend HTTP server listens on. The frontend will call the API at `http://localhost:PORT`.

**Example value:**
```env
PORT=4000
```

**When to change it:**
Only if port 4000 is already in use on your machine by another process. If you change this, you must also update:
1. `GOOGLE_REDIRECT_URI` to use the new port
2. The redirect URI registered in Google Cloud Console
3. `CLIENT_URL` if it refers to the port

**What happens if the port is in use:**
```
Error: listen EADDRINUSE: address already in use :::4000
```
See the Troubleshooting section in the main README for how to free the port.

---

### `CLIENT_URL`

**Required: No**

**Default:** `http://localhost:5173`

**What it does:**
The URL of the React frontend. Used for two purposes:
1. **CORS**: The backend only accepts API requests from this origin. Requests from any other origin are blocked.
2. **OAuth redirect**: After a successful Google login, the backend redirects the browser to `CLIENT_URL/settings?auth=connected`.

**Example value:**
```env
CLIENT_URL=http://localhost:5173
```

**When to change it:**
- If you change the Vite dev server port (defaults to 5173)
- If you deploy the frontend to a different domain or port
- When running in production (set to your actual domain)

**What happens if it's wrong:**
- API requests from the frontend will fail with CORS errors in the browser console.
- After Google OAuth, the browser won't redirect to the right URL.

---

### `LOG_LEVEL`

**Required: No**

**Default:** `info`

**What it does:**
Controls how much detail the backend logs to the console and log files. Uses [Pino's log levels](https://getpino.io/#/docs/api?id=level-string).

**Valid values (from most verbose to least):**
| Value | What gets logged |
|---|---|
| `trace` | Everything, including internal function calls |
| `debug` | Detailed debug information |
| `info` | Normal operational messages (recommended default) |
| `warn` | Warnings and errors |
| `error` | Errors only |
| `fatal` | Only fatal crashes |
| `silent` | Nothing |

**Example value:**
```env
LOG_LEVEL=info
```

**When to change it:**
- Set to `debug` or `trace` when troubleshooting an issue
- Set to `warn` or `error` in production to reduce noise
- Set to `silent` to disable all logging

**What happens if it's an invalid value:**
The Zod schema accepts any string — an invalid level is passed to Pino, which may default to `info` or produce unexpected behavior.

---

### `TOKEN_ENCRYPTION_KEY`

**Required: No** — recommended for Gmail sending.

**What it does:**
Encrypts the Google refresh token before it is stored in the database. Use one stable random value for this project and keep it private.

**Example value:**
```env
TOKEN_ENCRYPTION_KEY=replace-with-a-stable-random-secret-at-least-16-chars
```

**What happens if it's missing:**
The server falls back to existing local secrets so the app remains backward compatible, but setting this variable is safer and makes token encryption independent from Google credential rotation.

**Important:** Do not change this value after connecting Google unless you reconnect Google afterward. Existing encrypted refresh tokens need the same key to be decrypted.

---

### `GEMINI_API_KEY`

**Required: No** — only required for the **Cover Letter Generator** feature

**What it does:**
Authenticates requests to the Google Gemini AI API. The backend uses this key when calling Gemini to generate cover letter emails from your resume PDF.

If this variable is not set, or is set to the placeholder `your-gemini-api-key-here`, the Cover Letter Generator page will return an error when you try to generate.

**Format:**
A string starting with `AIzaSy...`

**Example value:**
```env
GEMINI_API_KEY=your-gemini-api-key-here
```

**Where to get it:**
[aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) — free, requires a Google account.

See full instructions: [`docs/CONFIGURATION_GUIDE.md` → Section 3](CONFIGURATION_GUIDE.md#3-google-gemini-ai-optional)

**What happens if it's missing or invalid:**
The Cover Letter Generator returns:
```
GEMINI_API_KEY is not configured. Please add a valid Gemini API Key to your 'server/.env' file and restart the backend server process.
```
All other features (Gmail sending, templates, contacts, campaigns) are unaffected.

**Security note:** API keys can be abused to make costly requests on your behalf. Keep this key private and never commit it.

---

### `GEMINI_MODEL_NAME`

**Required: No**

**Default:** `gemini-3.1-flash-lite`

**What it does:**
Specifies which Gemini model is used for cover letter generation. Different models offer different trade-offs between speed, quality, and cost.

**Example value:**
```env
GEMINI_MODEL_NAME=gemini-3.1-flash-lite
```

**Available models:**
See the official [Gemini models list](https://ai.google.dev/gemini-api/docs/models). The default model (`gemini-3.1-flash-lite`) is fast and efficient, suitable for cover letter generation.

**When to change it:**
You generally don't need to change this. If you want higher quality output and are willing to accept slightly slower generation, you could try a more capable model. If the default model is deprecated in future, update this to a current model name.

**What happens if the model name is invalid:**
The Gemini API returns a `404` with a message like `models/your-model-name is not found`. Fix by setting a valid model name or removing the variable to use the default.

---

## Security Best Practices

### 1. Never commit `server/.env` to version control

The `.gitignore` file already excludes `server/.env`. Double-check before committing:
```bash
git status   # server/.env should never appear here
```

If you accidentally commit it:
1. Immediately revoke the exposed credentials (Google Cloud Console → delete the OAuth client, Google AI Studio → delete the API key)
2. Remove the file from Git history (this is complex — seek help)
3. Create new credentials

### 2. Never share your `.env` file

Don't paste it in chat, email, or screenshots. If someone else needs to set up the project, share `.env.example` only.

### 3. Use strong PostgreSQL passwords

When creating your PostgreSQL user, use a strong password — especially if your machine is on a shared network.

### 4. Keep OAuth scopes minimal

This project requests only `gmail.send` and `userinfo.email` scopes — the minimum needed. Do not add additional scopes unless you're building new features that require them.

### 5. Rotate credentials if exposed

If you suspect any credential has been compromised:
- **Google Client Secret**: Google Cloud Console → Credentials → Reset Secret
- **Gemini API Key**: Google AI Studio → delete and create a new key
- **Database**: Change the postgres user password with `ALTER USER postgres PASSWORD 'newpassword';`

---

## Common Configuration Errors

| Error message | Likely cause | Fix |
|---|---|---|
| `Invalid environment configuration: DATABASE_URL: String must contain at least 1 character` | `DATABASE_URL` is missing from `server/.env` | Create `server/.env` from `.env.example` and set `DATABASE_URL` |
| `connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running | Start the PostgreSQL service |
| `database "email_sender" does not exist` | Database was never created | `psql -U postgres -c "CREATE DATABASE email_sender;"` |
| `password authentication failed for user "postgres"` | Wrong password in `DATABASE_URL` | Check the password against what you set during PostgreSQL installation |
| `Google OAuth environment variables are not configured` | One or more Google env vars missing | Set all three: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| `Error 400: redirect_uri_mismatch` | Redirect URI in Google Console doesn't match `GOOGLE_REDIRECT_URI` | Make both exactly `http://localhost:4000/api/auth/callback` |
| `GEMINI_API_KEY is not configured` | `GEMINI_API_KEY` not set or still the placeholder | Get a real API key from [aistudio.google.com](https://aistudio.google.com) |
| `models/xyz is not found` | Invalid `GEMINI_MODEL_NAME` | Use a valid model name or remove the variable |
| Changes to `.env` have no effect | Backend was not restarted after editing | `Ctrl+C` to stop, then `npm run dev` again |

---

## How the server validates environment variables

When the backend starts, `server/src/config.ts` runs all environment variables through a **Zod schema** — a type-safe validation library. If any required variable is missing or has an invalid format, the server prints a descriptive error and exits immediately.

Example startup error:
```
Error: Invalid environment configuration: DATABASE_URL: String must contain at least 1 character
```

This fail-fast behavior is intentional — it's better to crash immediately with a clear error than to silently ignore a misconfiguration and fail later during a send.

If you see this error, read the message carefully — it tells you exactly which variable is invalid and why.
